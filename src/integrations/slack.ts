import * as D from "../framework"

const WebClient = require("@slack/client").WebClient

export interface IChannel {
  id: string,
  label: string,
}

export class SlackIntegration extends D.Integration {

  constructor() {
    super()
    this.name = "slack"
    this.label = "Slack"
    this.iconName = "slack.png"
    this.description = "Write data to slack"
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
    this.params = [
      {
        name: "slack_api_token",
        label: "Slack API Token",
        required: true,
        description: "https://api.slack.com/custom-integrations/legacy-tokens",
        sensitive: true,
      },
    ]
  }

  async action(request: D.DataActionRequest) {
    return new Promise <D.DataActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        throw "Couldn't get data from attachment."
      }

      if (!request.formParams ||
        !request.formParams.channel) {
        throw "Missing channel."
      }

      const slack = this.slackClientFromRequest(request)

      const options = {
        content: request.attachment.dataBuffer,
        channels: request.formParams.channel,
        filetype: request.attachment.fileExtension,
        initial_comment: request.formParams.initial_comment,
      }

      const fileName = request.formParams.filename ? request.formParams.filename : request.suggestedFilename()

      slack.files.upload(fileName, options, (err: any) => {
        if (err) {
          reject(err)
        } else {
          resolve(new D.DataActionResponse())
        }
      })
    })
  }

  async form(request: D.DataActionRequest) {
    const form = new D.DataActionForm()
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

  async usableChannels(request: D.DataActionRequest) {
    let channels = await this.usablePublicChannels(request)
    channels = channels.concat(await this.usableDMs(request))
    return channels
  }

  usablePublicChannels(request: D.DataActionRequest) {
    return new Promise<IChannel[]>((resolve, reject) => {
      const slack = this.slackClientFromRequest(request)
      slack.channels.list({
        exclude_archived: 1,
        exclude_members: 1,
      }, (err: any, response: any) => {
        if (err || !response.ok) {
          reject(err)
        } else {
          const channels = response.channels.filter((c: any) => c.is_member && !c.is_archived)
          const reformatted: IChannel[] = channels.map((channel: any) => ({id: channel.id, label: `#${channel.name}`}))
          resolve(reformatted)
        }
      })
    })
  }

  usableDMs(request: D.DataActionRequest) {
    return new Promise<IChannel[]>((resolve, reject) => {
      const slack = this.slackClientFromRequest(request)
      slack.users.list({}, (err: any, response: any) => {
        if (err || !response.ok) {
          reject(err)
        } else {
          const users = response.members.filter((u: any) => {
            return !u.is_restricted && !u.is_ultra_restricted && !u.is_bot && !u.deleted
          })
          const reformatted: IChannel[] = users.map((user: any) => ({id: user.id, label: `@${user.name}`}))
          resolve(reformatted)
        }
      })
    })
  }

  private slackClientFromRequest(request: D.DataActionRequest) {
    return new WebClient(request.params.slack_api_token)
  }

}

D.addIntegration(new SlackIntegration())
