import * as Hub from "../../hub"

import * as httpRequest from "request-promise-native"

const DR_API_URL = "https://app.datarobot.com/api/v2"

export class DataRobotAction extends Hub.Action {

  name = "datarobot"
  label = "DataRobot - Create New Project"
  iconName = "datarobot/dr-head.svg"
  description = "Send data to DataRobot and create a new project."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  supportedFormats = [Hub.ActionFormat.Csv]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  requiredFields = []
  usesStreaming = true
  params = [
    {
      name: "datarobot_api_token",
      label: "DataRobot API Token",
      description: "API Token from https://app.datarobot.com/account/me",
      required: true,
      sensitive: true,
    },
  ]
  minimumSupportedLookerVersion = "5.24.0"

  async execute(request: Hub.ActionRequest) {
    const options = {
      url: `${DR_API_URL}/projects/`,
      headers: {
        Authorization: `Token ${request.params.datarobot_api_token}`,
      },
      body: {
        projectName: request.formParams.projectName,
        url: request.scheduledPlan && request.scheduledPlan.downloadUrl,
      },
      json: true,
      resolveWithFullResponse: true,
    }

    try {
      await httpRequest.post(options).promise()
      return new Hub.ActionResponse({ success: true })
    } catch (e) {
      return new Hub.ActionResponse({ success: false, message: e.message })
    }
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    if (!request.params.datarobot_api_token) {
      form.error = "No DataRobot API Token configured; consult your Looker admin."
      return form
    }

    try {
      await this.validateDataRobotToken(request.params.datarobot_api_token)

      form.fields = [
        {
          label: "The name of the project to be created",
          name: "projectName",
          required: false,
          type: "string",
        },
      ]
    } catch (e) {
      form.error = this.prettyDataRobotError(e)
    }

    return form
  }

  private async validateDataRobotToken(token: string) {
    try {
      await httpRequest.get({
        url: `${DR_API_URL}/projects/`,
        headers: {
          Authorization: `Token ${token}`,
        },
        json: true,
      }).promise()
    } catch (e) {
      throw new Error("Invalid token")
    }
  }

  private prettyDataRobotError(e: Error) {
    if (e.message === "Invalid token") {
      return "Your DataRobot API token is invalid."
    }
    return e.message
  }
}

Hub.addAction(new DataRobotAction())
