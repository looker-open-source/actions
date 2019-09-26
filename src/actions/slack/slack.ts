import * as Hub from "../../hub"

import { WebClient } from "@slack/client"

interface Channel {
  id: string,
  label: string,
}

interface AuthTestResult {
  ok: boolean,
  team: string,
  team_id: string,
}

const apiLimitSize = 1000

export class SlackAction extends Hub.DelegateOAuthAction {

  name = "slack_app"
  label = "Slack"
  iconName = "slack/slack.png"
  description = "Search, explore and share Looker content in Slack."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [{
    name: "install",
    label: "Connect to Slack",
    delegate_oauth_url: "/admin/integrations/slack/install",
    required: false,
    sensitive: false,
    description: `Allow users to view dashboards and looks without leaving Slack,
     browse and view their favorites or folders, and search for content using Slack command.`
  }]
  usesStreaming = true

  async execute(request: Hub.ActionRequest) {

    if (!request.formParams.channel) {
      throw "Missing channel."
    }

    const fileName = request.formParams.filename || request.suggestedFilename()

    let response = new Hub.ActionResponse({success: true})
    try {
      const slack = this.slackClientFromRequest(request)
      await request.stream(async (readable) => {
        await slack.files.upload({
          file: readable,
          filename: fileName,
          channels: request.formParams.channel,
          initial_comment: request.formParams.initial_comment ? request.formParams.initial_comment : "",
        })
      })
    } catch (e) {
      response = new Hub.ActionResponse({success: false, message: e.message})
    }
    return response
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    try {
      const channels = await this.usableChannels(request)
      form.fields = [
      {
        description: "Name of the Slack channel you would like to post to.",
        label: "Share In",
        name: "channel",
        options: channels.map((channel) => ({ name: channel.id, label: channel.label })),
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
    } catch (e) {
      const oauthUrl = request.params.state_json
      if (oauthUrl) {
        form.state = new Hub.ActionState()
        form.fields.push({
          name: "login",
          type: "oauth_link",
          label: "Log in",
          description: "In order to send to a file, you will need to log in to your Slack account.",
          oauth_url: oauthUrl,
        })
      } else {
        form.error = this.prettySlackError(e)
      }
    }
    return form
  }

  async authTest(request: Hub.ActionRequest) {
    const slack = this.slackClientFromRequest(request)
    return await slack.auth.test() as AuthTestResult
  }

  async usableChannels(request: Hub.ActionRequest) {
    let channels = await this.usablePublicChannels(request)
    channels = channels.concat(await this.usableDMs(request))
    channels.sort((a, b) => ((a.label < b.label) ? -1 : 1 ))
    return channels
  }

  async usablePublicChannels(request: Hub.ActionRequest) {
    const slack = this.slackClientFromRequest(request)
    const options: any = {
      exclude_archived: true,
      exclude_members: true,
      limit: apiLimitSize,
    }
    const pageLoaded = async (accumulatedChannels: any[], response: any): Promise<any[]> => {
      const mergedChannels = accumulatedChannels.concat(response.channels)

      // When a `next_cursor` exists, recursively call this function to get the next page.
      if (response.response_metadata &&
          response.response_metadata.next_cursor &&
          response.response_metadata.next_cursor !== "") {
        const pageOptions = { ...options }
        pageOptions.cursor = response.response_metadata.next_cursor
        return pageLoaded(mergedChannels, await slack.channels.list(pageOptions))
      }
      return mergedChannels
    }
    const paginatedChannels = await pageLoaded([], await slack.channels.list(options))
    const channels = paginatedChannels.filter((c: any) => c.is_member && !c.is_archived)
    const reformatted: Channel[] = channels.map((channel: any) => ({id: channel.id, label: `#${channel.name}`}))
    return reformatted
  }

  async usableDMs(request: Hub.ActionRequest) {
    const slack = this.slackClientFromRequest(request)
    const options: any = {
      limit: apiLimitSize,
    }
    const pageLoaded = async (accumulatedUsers: any[], response: any): Promise<any[]> => {
      const mergedUsers = accumulatedUsers.concat(response.members)

      // When a `next_cursor` exists, recursively call this function to get the next page.
      if (response.response_metadata &&
          response.response_metadata.next_cursor &&
          response.response_metadata.next_cursor !== "") {
        const pageOptions = { ...options }
        pageOptions.cursor = response.response_metadata.next_cursor
        return pageLoaded(mergedUsers, await slack.users.list(pageOptions))
      }
      return mergedUsers
    }
    const paginatedUsers = await pageLoaded([], await slack.users.list(options))
    const users = paginatedUsers.filter((u: any) => {
      return !u.is_restricted && !u.is_ultra_restricted && !u.is_bot && !u.deleted
    })
    const reformatted: Channel[] = users.map((user: any) => ({id: user.id, label: `@${user.name}`}))
    return reformatted
  }

  async oauthCheck(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    if (!request.params.state_json) {
        form.error = "You must connect to a Slack workspace first."
        return form
    }
    try {
      const resp = await this.authTest(request)

      form.fields.push({
        name: "Connected",
        type: "message",

        value: `Connected with ${resp.team} (${resp.team_id})`,
      })
    } catch (e) {
      form.error = this.prettySlackError(e)
    }
    return form
  }

  private prettySlackError(e: any) {
    if (e.message === "An API error occurred: invalid_auth") {
      return "Your Slack authentication credentials are not valid."
    } else {
      return e
    }
  }

  private slackClientFromRequest(request: Hub.ActionRequest) {
      return new WebClient(request.params.state_json)
  }
}

Hub.addAction(new SlackAction())
