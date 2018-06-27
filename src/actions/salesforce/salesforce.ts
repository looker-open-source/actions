import * as Hub from "../../hub"

import * as jsforce from "jsforce"

const TAG = "salesforce_object_id"

export class SalesforceAction extends Hub.Action {
  name = "salesforce"
  label = "Salesforce"
  iconName = "salesforce/salesforce.svg"
  description = "Update records in Salesforce"
  params = [

  ]
  supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  requiredFields = [{ tag: TAG }]

  async execute(request: Hub.ActionRequest) {
    let objectIds: string[] = []
    switch (request.type) {
      case Hub.ActionType.Query:
        if (!(request.attachment && request.attachment.dataJSON)) {
          throw "Couldn't get data from attachment."
        }

        const qr = request.attachment.dataJSON
        if (!qr.fields || !qr.data) {
          throw "Request payload is an invalid format."
        }
        const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
        const identifiableFields = fields.filter((f: any) =>
          f.tags && f.tags.some((t: string) => t === TAG),
        )
        if (identifiableFields.length === 0) {
          throw `Query requires a field tagged ${TAG}.`
        }
        objectIds = qr.data.map((row: any) => (row[identifiableFields[0].name].value))
        break
      case Hub.ActionType.Cell:
        const value = request.params.value
        if (!value) {
          throw "Couldn't get data from cell."
        }
        objectIds = [value]
        break
    }

    const jsforceClient = this.jsforceClientFromRequest(request)

    try {
      jsforceClient.sobject("Account").find({
        Id : { $in : objectIds },
      }).update({ Status: request.formParams.status })
    } catch (e) {
      return new Hub.ActionResponse({success: false, message: e.message})
    }
    return new Hub.ActionResponse({ success: true })
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Status",
      name: "status",
      type: "string",
      required: true,
    }]
    return form
  }

  private jsforceClientFromRequest(request: Hub.ActionRequest) {
    return new jsforce.Connection()
  }

}

Hub.addAction(new SalesforceAction())
