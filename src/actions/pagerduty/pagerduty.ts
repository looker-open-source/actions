import * as Hub from "../../hub"
import { PagerDutyClient } from './pagerduty_client'
import { PagerDutyForm } from './pagerduty_form'
import * as winston from "winston"

export class PagerDutyAction extends Hub.Action {
  name = "pagerduty"
  label = "PagerDuty"
  iconName = "pagerduty/pd_icon.png"
  description = `PagerDuty (${process.env.ACTION_HUB_LABEL})`
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [{
    name: "pagerduty_api_key",
    label: "PagerDuty API Key",
    required: true,
    description: `A PagerDuty API key used to authenticate with the PagerDuty REST API. For how to generate a key, please follow instructions at https://support.pagerduty.com/docs/generating-api-keys`,
    sensitive: true,
  }]
  usesStreaming = false

  async execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse> {
    function validationError(e: Hub.ValidationError): Hub.ActionResponse {
      console.warn(`Couldn't execute request: ${e.message}`)
      return new Hub.ActionResponse({ message: 'Validation error', success: false, validationErrors: [e] })
    }

    const form = PagerDutyForm.create(request.formParams)
    const apiKey = this.getApiKey(request)
    const resultSet = this.parseResultSet(request.attachment)
    
    if (request.scheduledPlan == null)
      return validationError({field: '', message: 'PagerDuty action only available for schedule queries'})

    if (typeof apiKey !== "string")
      return validationError(apiKey)

    if (!Array.isArray(resultSet))
      return validationError(resultSet)

    const trimmedResultset = resultSet.slice(0, form.max_incidents)

    const incidents = form.createPagerDutyIncidents(trimmedResultset, request.scheduledPlan)

    if (!Array.isArray(incidents))
      return validationError(incidents)

    const client = new PagerDutyClient(apiKey)

    return client.createIncidents(incidents, [form.service_key], form.schedule_id)
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    const apiKey = this.getApiKey(request)

    if (typeof apiKey !== "string") {
      form.error = apiKey.message
      return form
    }

    const client = new PagerDutyClient(apiKey)

    // Call a remote endpoint to verify that the API key is correct
    // The 'form' method is invoked when the API key is entered in the Looker admin configuration
    const services = await client.services()
    winston.info(`PagerDuty key validation OK. Found ${services.length} services.`)

    form.fields = PagerDutyForm.formFields
    return form
  }

  private getApiKey(request: Hub.ActionRequest): Hub.ValidationError | string {
    const apiKey = request.params['pagerduty_api_key']

    if (apiKey == null)
      return {
        field: 'pagerduty_api_key',
        message: "API Key not configured for Looker. Please configured it in the admin section."
      }

    return apiKey
  }

  private parseResultSet(attachment: Hub.ActionAttachment | undefined): Hub.ValidationError | any[] {
    if (attachment == null)
      return {
        field: 'service_key',
        message: "Please format data as JSON input, field not found 'attachment'"
      }

    if (attachment.mime !== 'application/json')
      return {
        field: 'service_key',
        message: `Please format data as JSON input. Expected MIME type 'application/json', got ${attachment.mime}`
      }

    if (attachment.dataJSON == null) {
      // Looker sent empty report
      return []
    } else {
      if (Array.isArray(attachment.dataJSON))
        return attachment.dataJSON
      else if (Array.isArray(attachment.dataJSON.data))
        return attachment.dataJSON.data
      else return {
        field: 'service_key',
        message: 'JSON array or object expected'
      }
    }
  }
}

Hub.addAction(new PagerDutyAction())
