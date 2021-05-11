import * as req from "request-promise-native"

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

export class HeapAction extends Hub.Action {
  static ADD_USER_PROPERTIES_URL =
    "https://heapanalytics.com/api/add_user_properties"
  static ADD_ACCOUNT_PROPERTIES_URL =
    "https://heapanalytics.com/api/add_account_properties"
  static HEAP_LIBRARY = "looker"

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
  supportedFormats = [Hub.ActionFormat.JsonDetail]

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

    await request.streamJsonDetail({
      onFields: (fieldset) => {
        const allFields = Hub.allFields(fieldset)
        heapFieldName = this.extractHeapFieldName(allFields, heapFieldLabel)
        fieldMap = this.extractFieldMap(allFields)
      },
      // :TODO: possibly optimize by batching rows and calling the bulk endpoint
      onRow: (row) => {
        try {
          const { heapFieldValue, properties } = this.extractPropertiesFromRow(
            row,
            heapFieldName,
            heapFieldLabel,
            fieldMap,
          )
          if (!heapFieldValue) {
            return
          }
          const requestBody = this.constructBodyForRequest(
            request.params.heap_env_id!,
            heapField,
            heapFieldValue,
            properties,
          )
          req.post({
            uri: requestUrl,
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          })
        } catch (err) {
          errors.push(err)
        }
      },
    })

    if (errors.length === 0) {
      return new Hub.ActionResponse({ success: true })
    }
    const errorMsg = errors.map((err) => err.message).join(", ")
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
    row: Hub.JsonDetail.Row,
    heapFieldName: string,
    heapFieldLabel: string,
    allFieldMap: LookerFieldMap,
  ): {
    heapFieldValue: string | undefined;
    properties: { [K in string]: string };
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
        const propertyName =
          field.label !== undefined ? field.label : fieldName
        // :TODO: what are and how to handle PivotCells?
        const propertyValue = cell.value
        if (propertyValue) {
          const typedValue = field.is_numeric
            ? +propertyValue
            : propertyValue.toString().substring(0, 1024)
          properties[propertyName] = typedValue
        }
      }
    }
    return { properties, heapFieldValue }
  }

  private constructBodyForRequest(
    appId: string,
    heapField: HeapField,
    heapFieldValue: string,
    properties: PropertyMap,
  ): string {
    const baseRequestBody = { app_id: appId, library: HeapAction.HEAP_LIBRARY }
    let jsonBody = {}
    if (heapField === HeapFields.Identity) {
      jsonBody = {
        users: [
          {
            user_identifier: { email: heapFieldValue },
            properties,
          },
        ],
      }
    } else if (heapField === HeapFields.AccountId) {
      jsonBody = {
        accounts: [
          {
            account_id: heapFieldValue,
            properties,
          },
        ],
      }
    }
    return JSON.stringify(Object.assign({}, baseRequestBody, jsonBody))
  }
}

Hub.addAction(new HeapAction())
