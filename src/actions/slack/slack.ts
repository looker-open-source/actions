import * as D from "../../framework"

const WebClient = require("@slack/client").WebClient

interface Channel {
  id: string,
  label: string,
}

export class SlackAttachmentAction extends D.Action {

  constructor() {
    super()
    this.name = "slack"
    this.label = "Slack Attachment"
    this.iconName = "slack/slack.png"
    this.description = "Write a data file to Slack."
    this.supportedActionTypes = [D.ActionType.Query, D.ActionType.Dashboard]
    this.requiredFields = []
    this.params = [{
      name: "slack_api_token",
      label: "Slack API Token",
      required: true,
      description: "https://api.slack.com/custom-integrations/legacy-tokens",
      sensitive: true,
    }]
  }

  async action(request: D.ActionRequest) {
    return new Promise <D.ActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        reject("Couldn't get data from attachment.")
        return
      }

      if (!request.formParams || !request.formParams.channel) {
        reject("Missing channel.")
        return
      }

      const slack = this.slackClientFromRequest(request)

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
      slack.files.upload(fileName, options, (err: any) => {
        if (err) {
          response = {success: true, message: err.message}
        }
      })
      resolve(new D.ActionResponse(response))
    })
  }

  async form(request: D.ActionRequest) {
    const form = new D.ActionForm()
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

  async usableChannels(request: D.ActionRequest) {
    let channels = await this.usablePublicChannels(request)
    channels = channels.concat(await this.usableDMs(request))
    return channels
  }

  async usablePublicChannels(request: D.ActionRequest) {
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

  async usableDMs(request: D.ActionRequest) {
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

  private slackClientFromRequest(request: D.ActionRequest) {
    return new WebClient(request.params.slack_api_token!)
  }

}

D.addAction(new SlackAttachmentAction())
