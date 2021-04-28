import * as Hub from "../../hub"

import * as req from "request-promise-native"

// HeapTags enumerates supported identifiers for each endpoint
// - "identity" is the user identifier for the user properties export
// - "account_id" is the account identifier for the account properties export
export enum HeapTags {
  Identity = "identity",
  AccountId = "account_id",
}

export type HeapTag = HeapTags.Identity | HeapTags.AccountId

export class HeapAction extends Hub.Action {
  static ADD_USER_PROPERTIES_URL =
    "https://heapanalytics.com/api/add_user_properties"
  static ADD_ACCOUNT_PROPERTIES_URL =
    "https://heapanalytics.com/api/add_account_properties"
  description = "Add user and account properties to your Heap dataset"
  label = "Heap"
  iconName = "heap/heap.svg"
  name = "heap"
  params = [
    {
      description: "Heap App ID",
      label: "Heap App ID",
      name: "heap_app_id",
      required: true,
      sensitive: true,
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query]
  allowedIdTags: string[] = Object.values(HeapTags)
  requiredFields = [{ any_tag: this.allowedIdTags }]
  usesStreaming = true
  supportedFormats = [Hub.ActionFormat.JsonDetail]

  async execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse> {
    let allFields: Hub.Field[] = []
    const errors: Error[] = []
    let heapField: Hub.Field
    let heapTag: HeapTag
    let requestUrl: string
    const baseRequestBody = { app_id: request.params.heap_app_id }

    try {
      await request.streamJsonDetail({
        // :TODO: verify onFields is ran synchronously before onRow
        onFields: (fields) => {
          allFields = Hub.allFields(fields)
          const heapFieldAndTag = this.extractHeapFieldAndTag(allFields)
          heapField = heapFieldAndTag.heapField
          heapTag = heapFieldAndTag.heapTag
          requestUrl = this.resolveApiEndpoint(heapTag)
        },
        // :TODO: possibly optimize by batching rows and calling the bulk endpoint
        onRow: (row) => {
          try {
            const {
              heapFieldValue,
              properties,
            } = this.extractPropertiesFromRow(row, heapField, heapTag)
            const requestBody = Object.assign({}, baseRequestBody, {
              [heapTag]: heapFieldValue,
              properties,
            })
            req.post({
              uri: requestUrl,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            })
          } catch (err) {
            errors.push(err)
          }
        },
      })
    } catch (err) {
      errors.push(err)
    }

    if (errors.length === 0) {
      return new Hub.ActionResponse({ success: true })
    }
    const errorMsg = errors.map((err) => err.message).join(", ")
    return new Hub.ActionResponse({ success: false, message: errorMsg })
  }

  private extractHeapFieldAndTag(
    fields: Hub.Field[],
  ): { heapField: Hub.Field; heapTag: HeapTag } {
    const maybeHeapFields = fields.filter(
      (field) =>
        field.tags &&
        field.tags.length > 0 &&
        field.tags.some((tag) => this.allowedIdTags.includes(tag)),
    )
    if (maybeHeapFields.length === 1) {
      const heapField = maybeHeapFields[0]
      const heapTags = heapField.tags!.filter((tag) =>
        this.allowedIdTags.includes(tag),
      )
      if (heapTags.length > 1) {
        throw new Error(
          `Found a field tagged with multiple Heap tags: ${heapTags.join(", ")}`,
        )
      }
      return { heapField, heapTag: heapTags[0] as HeapTag }
    } else if (maybeHeapFields.length === 0) {
      throw new Error(
        `Did not find one of the required tags: ${this.allowedIdTags.join(
          ", ",
        )}`,
      )
    } else {
      throw new Error(
        `Found multiple columns tagged with one of the Heap tags: ${maybeHeapFields
          .map((field) => field.name)
          .join(", ")}`,
      )
    }
  }

  private resolveApiEndpoint(heapTag: HeapTag): string {
    switch (heapTag) {
      case HeapTags.Identity:
        return HeapAction.ADD_USER_PROPERTIES_URL
      case HeapTags.AccountId:
        return HeapAction.ADD_ACCOUNT_PROPERTIES_URL
      default:
        throw new Error(`Unsupported Heap tag: ${heapTag}`)
    }
  }

  private extractPropertiesFromRow(
    row: Hub.JsonDetail.Row,
    heapField: Hub.Field,
    heapTag: HeapTag,
  ): { heapFieldValue: string; properties: { [K in string]: string } } {
    if (!row.hasOwnProperty(heapField.name)) {
      throw new Error(`Found a row without the ${heapTag} field`)
    }
    const heapFieldValue = row[heapField.name].value.toString()
    if (heapFieldValue === "") {
      throw new Error(`Found a row with an empty ${heapField.name} field. ${heapTag} is a required value`)
    }

    const properties: { [K in string]: string } = {}
    for (const [fieldName, cell] of Object.entries(row)) {
      if (fieldName !== heapField.name) {
        const lookerPropertyName = "Looker " + fieldName
        // :TODO: what are and how to handle PivotCells?
        properties[lookerPropertyName] = cell.value
          .toString()
          .substring(0, 1024)
      }
    }
    return { properties, heapFieldValue }
  }
}

Hub.addAction(new HeapAction())
