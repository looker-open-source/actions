import * as Hub from "../../hub"

const WebClient = require("@slack/client").WebClient

interface Channel {
  id: string,
  label: string,
}

export class SlackAttachmentAction extends Hub.Action {

  name = "slack"
  label = "Slack Attachment"
  iconName = "slack/slack.png"
  description = "Write a data file to Slack."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [{
    name: "slack_api_token",
    label: "Slack API Token",
    required: true,
    description: "https://api.slack.com/custom-integrations/legacy-tokens",
    sensitive: true,
  }]

  async execute(request: Hub.ActionRequest) {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }

    if (!request.formParams || !request.formParams.channel) {
      throw "Missing channel."
    }

    const fileName = request.formParams.filename || request.suggestedFilename()

    const options = {
      file: {
        value: request.attachment.dataBuffer,
        options: {
          filename: fileName,
        },
      },
      channels: request.formParams.channel,
      filetype: request.attachment.fileExtension,
      initial_comment: request.formParams.initial_comment,
    }

    let response
    try {
      const slack = this.slackClientFromRequest(request)
      await new Promise<void>((resolve, reject) => {
        slack.files.upload(fileName, options, (err: any) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    } catch (e) {
      response = { success: false, message: e.message }
    }
    return new Hub.ActionResponse(response)
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    const channels = await this.usableChannels(request)

    form.fields = [{
      description: "Name of the Slack channel you would like to post to.",
      label: "Share In",
      name: "channel",
      options: channels.map((channel) => ({name: channel.id, label: channel.label})),
      required: true,
      type: "select",
    }, {
      label: "Comment",
      type: "string",
      name: "initial_comment",
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]

    return form
  }

  async usableChannels(request: Hub.ActionRequest) {
    let channels = await this.usablePublicChannels(request)
    channels = channels.concat(await this.usableDMs(request))
    return channels
  }

  async usablePublicChannels(request: Hub.ActionRequest) {
    return new Promise<Channel[]>((resolve, reject) => {
      const slack = this.slackClientFromRequest(request)
      slack.channels.list({
        exclude_archived: 1,
        exclude_members: 1,
      }, (err: any, response: any) => {
        if (err || !response.ok) {
          reject(err)
        } else {
          const channels = response.channels.filter((c: any) => c.is_member && !c.is_archived)
          const reformatted: Channel[] = channels.map((channel: any) => ({id: channel.id, label: `#${channel.name}`}))
          resolve(reformatted)
        }
      })
    })
  }

  async usableDMs(request: Hub.ActionRequest) {
    return new Promise<Channel[]>((resolve, reject) => {
      const slack = this.slackClientFromRequest(request)
      slack.users.list({}, (err: any, response: any) => {
        if (err || !response.ok) {
          reject(err)
        } else {
          const users = response.members.filter((u: any) => {
            return !u.is_restricted && !u.is_ultra_restricted && !u.is_bot && !u.deleted
          })
          const reformatted: Channel[] = users.map((user: any) => ({id: user.id, label: `@${user.name}`}))
          resolve(reformatted)
        }
      })
    })
  }

  private slackClientFromRequest(request: Hub.ActionRequest) {
    return new WebClient(request.params.slack_api_token!)
  }

}

Hub.addAction(new SlackAttachmentAction())
