import * as req from "request-promise-native"
import * as semver from "semver"
import * as winston from "winston"

import * as Hub from "../../hub"

export enum HeapPropertyTypes {
  User = "user",
  Account = "account",
}
export type HeapPropertyType =
  | HeapPropertyTypes.Account
  | HeapPropertyTypes.User

// HeapFields enumerates supported identifiers for each endpoint
// - "identity" is the user identifier for the user properties export
// - "account_id" is the account identifier for the account properties export
export enum HeapFields {
  Identity = "identity",
  AccountId = "account_id",
}

export type HeapField = HeapFields.Identity | HeapFields.AccountId

interface LookerFieldMap {
  [fieldName: string]: Hub.Field
}

interface PropertyMap {
  [property: string]: string
}

interface HeapEntity {
  heapFieldValue: string
  properties: PropertyMap
}

export class HeapAction extends Hub.Action {
  static ADD_USER_PROPERTIES_URL =
    "https://heapanalytics.com/api/integrations/add_user_properties"
  static ADD_ACCOUNT_PROPERTIES_URL =
    "https://heapanalytics.com/api/add_account_properties"
  static HEAP_TRACK_URL = "https://heapanalytics.com/api/track"
  static HEAP_LIBRARY = "looker"
  static ROWS_PER_BATCH = 1000
  // TODO: remove me before GA
  static HEAP_ENV_ID = process.env.HEAP_ENV_ID
  static HEAP_IDENTITY = process.env.HEAP_IDENTITY
  static HEAP_EVENT_NAME = "Submit Looker Action"
  static LOG_PROGRESS_STEP = 10000

  description = "Add user and account properties to your Heap dataset"
  label = "Heap"
  iconName = "heap/heap.svg"
  name = "heap"
  params = [
    {
      description: "Heap Env ID",
      label: "Heap Env ID",
      name: "heap_env_id",
      required: true,
      sensitive: true,
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query]
  supportedPropertyTypes = [HeapPropertyTypes.User, HeapPropertyTypes.Account]
  usesStreaming = true
  supportedFormats = (request: Hub.ActionRequest) => {
    if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
      return [Hub.ActionFormat.JsonDetailLiteStream]
    } else {
      return [Hub.ActionFormat.JsonDetail]
    }
  }

  async execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse> {
    if (
      !request.formParams.property_type ||
      !(this.supportedPropertyTypes as string[]).includes(
        request.formParams.property_type,
      )
    ) {
      throw new Error(
        `Unsupported property type: ${request.formParams.property_type}`,
      )
    }
    const propertyType: HeapPropertyType = request.formParams
      .property_type as HeapPropertyType

    if (
      !request.formParams.heap_field ||
      request.formParams.heap_field.length === 0
    ) {
      throw new Error("Column mapping to a Heap field must be provided.")
    }
    const heapFieldLabel: string = request.formParams.heap_field
    let heapFieldName: string

    let fieldMap: LookerFieldMap = {} as LookerFieldMap
    const heapField = this.resolveHeapField(propertyType)
    const requestUrl = this.resolveApiEndpoint(propertyType)
    const errors: Error[] = []
    let rowCount = 0
    let requestBatch: HeapEntity[] = []
    const requestPromises: Promise<void>[] = []

    await request.streamJsonDetail({
      onFields: (fieldset) => {
        const allFields = Hub.allFields(fieldset)
        heapFieldName = this.extractHeapFieldName(allFields, heapFieldLabel)
        fieldMap = this.extractFieldMap(allFields)
      },
      onRow: (row) => {
        try {
          const { heapFieldValue, properties } = this.extractPropertiesFromRow(
            request.params.heap_env_id!,
            row,
            heapFieldName,
            heapFieldLabel,
            fieldMap,
          )
          if (!heapFieldValue) {
            return
          }
          rowCount += 1
          requestBatch.push({ heapFieldValue, properties })
          if (requestBatch.length === HeapAction.ROWS_PER_BATCH) {
            requestPromises.push(
              this.sendRequest(
                requestBatch,
                request.params.heap_env_id!,
                requestUrl,
                heapField,
                errors,
              ),
            )
            requestBatch = []

            if (rowCount % HeapAction.LOG_PROGRESS_STEP === 0) {
              winston.info(
                `Processed ${rowCount} rows in ${
                  rowCount / HeapAction.ROWS_PER_BATCH
                } batch requests.`,
              )
            }
          }
        } catch (err) {
          errors.push(err)
        }
      },
    })

    if (requestBatch.length > 0) {
      requestPromises.push(
        this.sendRequest(
          requestBatch,
          request.params.heap_env_id!,
          requestUrl,
          heapField,
          errors,
        ),
      )
    }

    try {
      await Promise.all(requestPromises)
    } catch (err) {
      errors.push(err)
    }

    try {
      await this.trackLookerAction(
        request.params.heap_env_id!,
        rowCount,
        heapField,
        errors.length === 0 ? "success" : "failure",
      )
    } catch (err) {
      winston.warn("Heap track call failed.")
      // swallow internal track call error
    }

    if (errors.length === 0) {
      return new Hub.ActionResponse({ success: true })
    }
    const errorMsg = errors.map((err) => err.message).join(", ")
    winston.error(
      `Heap action for envId ${request.params.heap_env_id} failed with errors: ${errorMsg}`,
    )
    return new Hub.ActionResponse({ success: false, message: errorMsg })
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [
      {
        label: "Property Type",
        name: "property_type",
        required: true,
        options: [
          { name: HeapPropertyTypes.Account, label: "Account" },
          { name: HeapPropertyTypes.User, label: "User" },
        ],
        type: "select",
      },
      {
        label:
          "Column name matching user join key or account ID property in Heap",
        name: "heap_field",
        required: true,
        type: "string",
      },
    ]
    return form
  }

  private extractHeapFieldName(fields: Hub.Field[], heapFieldLabel: string) {
    const heapFields = fields.filter((field) => field.label === heapFieldLabel)
    if (heapFields.length !== 1) {
      throw new Error(
        `Heap field (${heapFieldLabel}) is missing in the query result.`,
      )
    }
    return heapFields[0].name
  }

  private extractFieldMap(allFields: Hub.Field[]): LookerFieldMap {
    return allFields.reduce((fieldMap: LookerFieldMap, field: Hub.Field) => {
      const fieldName = field.name
      fieldMap[fieldName] = field
      return fieldMap
    }, {} as LookerFieldMap)
  }

  private resolveHeapField(propertyType: HeapPropertyType): HeapField {
    switch (propertyType) {
      case HeapPropertyTypes.Account:
        return HeapFields.AccountId
      case HeapPropertyTypes.User:
        return HeapFields.Identity
      default:
        throw new Error(`Unsupported property type: ${propertyType}`)
    }
  }

  private resolveApiEndpoint(propertyType: HeapPropertyType): string {
    switch (propertyType) {
      case HeapPropertyTypes.User:
        return HeapAction.ADD_USER_PROPERTIES_URL
      case HeapPropertyTypes.Account:
        return HeapAction.ADD_ACCOUNT_PROPERTIES_URL
      default:
        throw new Error(`Unsupported property type: ${propertyType}`)
    }
  }

  private extractPropertiesFromRow(
    appId: string,
    row: Hub.JsonDetail.Row,
    heapFieldName: string,
    heapFieldLabel: string,
    allFieldMap: LookerFieldMap,
  ): {
    heapFieldValue: string | undefined;
    properties: PropertyMap;
  } {
    if (!row.hasOwnProperty(heapFieldName)) {
      throw new Error(`Found a row without the ${heapFieldLabel} field`)
    }
    if (!row[heapFieldName].value) {
      return { heapFieldValue: undefined, properties: {} }
    }
    const heapFieldValue = row[heapFieldName].value.toString()

    const properties: { [K in string]: string } = {}
    for (const [fieldName, cell] of Object.entries(row)) {
      if (fieldName !== heapFieldName) {
        const field = allFieldMap[fieldName]
        // Field labels are the original name of the property that has not been sanitized or snake-cased.
        if (appId === HeapAction.HEAP_ENV_ID) {
          winston.info("HoH field", fieldName, cell, field)
        }
        const propertyName =
          field.label !== undefined ? field.label : fieldName
        const cellValue = cell.value ? cell.value : cell.filterable_value
        if (cellValue) {
          const propertyValue = cellValue.toString().substring(0, 1024)
          // Certain number formats are displayed with commas
          const sanitizedPropertyValue = field.is_numeric
            ? propertyValue.replace(/[^0-9\.]+/g, "")
            : propertyValue
          properties[propertyName] = sanitizedPropertyValue
        }
      }
    }
    return { properties, heapFieldValue }
  }

  private constructBodyForRequest(
    appId: string,
    heapField: HeapField,
    heapEntities: HeapEntity[],
  ): string {
    const baseRequestBody = { app_id: appId, library: HeapAction.HEAP_LIBRARY }
    let jsonBody = {}
    if (heapField === HeapFields.Identity) {
      jsonBody = {
        users: heapEntities.map(({ heapFieldValue, properties }) => ({
          user_identifier: { email: heapFieldValue },
          properties,
        })),
      }
    } else if (heapField === HeapFields.AccountId) {
      jsonBody = {
        accounts: heapEntities.map(({ heapFieldValue, properties }) => ({
          account_id: heapFieldValue,
          properties,
        })),
      }
    }
    if (appId === HeapAction.HEAP_ENV_ID) {
      winston.info("HoH request", jsonBody)
    }
    return JSON.stringify(Object.assign({}, baseRequestBody, jsonBody))
  }

  private async sendRequest(
    requestBatch: HeapEntity[],
    envId: string,
    requestUrl: string,
    heapField: HeapField,
    errors: Error[],
  ): Promise<void> {
    const requestBody = this.constructBodyForRequest(
      envId,
      heapField,
      requestBatch,
    )
    try {
      await req
        .post({
          uri: requestUrl,
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        })
        .promise()
    } catch (err) {
      errors.push(err)
    }
  }

  /**
   * REMOVE ME before GA. Send a track call to heap to summarize the attempted looker action request.
   * @param envId
   * @param recordCount the number of records that were processed by this action.
   * @param heapField identity or account id
   * @param state success if all records were processed correctly and error if any errors were encountered.
   */
  private async trackLookerAction(
    envId: string,
    recordCount: number,
    heapField: HeapField,
    state: "success" | "failure",
  ): Promise<void> {
    const now = new Date().toISOString()
    const requestBody = {
      app_id: HeapAction.HEAP_ENV_ID,
      identity: HeapAction.HEAP_IDENTITY,
      event: HeapAction.HEAP_EVENT_NAME,
      timestamp: now,
      properties: {
        customer_env_id: envId,
        record_count: recordCount,
        field_type: heapField,
        state,
      },
    }

    try {
      await req
        .post({
          uri: HeapAction.HEAP_TRACK_URL,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })
        .promise()
    } catch (err) {
      // swallow any errors in the track call
      return
    }
  }
}

Hub.addAction(new HeapAction())