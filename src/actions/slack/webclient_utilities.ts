import { WebClient } from "@slack/client"

const apiLimitSize = 1000

export interface Channel {
  id: string,
  label: string,
}

export function prettySlackError(e: any) {
  if (e.message === "An API error occurred: invalid_auth") {
    return "Your Slack authentication credentials are not valid."
  } else {
    return e
  }
}

export class WebClientUtilities {

  slack: WebClient
  constructor(slack: WebClient) {
    this.slack = slack
  }

  async usableChannels() {
    let channels = await this.usablePublicChannels()
    channels = channels.concat(await this.usableDMs())
    return channels
  }

  async usablePublicChannels() {
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
        return pageLoaded(mergedChannels, await this.slack.channels.list(pageOptions))
      }
      return mergedChannels
    }
    const paginatedChannels = await pageLoaded([], await this.slack.channels.list(options))
    const channels = paginatedChannels.filter((c: any) => c.is_member && !c.is_archived)
    const reformatted: Channel[] = channels.map((channel: any) => ({id: channel.id, label: `#${channel.name}`}))
    return reformatted
  }

  async usableDMs() {
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
        return pageLoaded(mergedUsers, await this.slack.users.list(pageOptions))
      }
      return mergedUsers
    }
    const paginatedUsers = await pageLoaded([], await this.slack.users.list(options))
    const users = paginatedUsers.filter((u: any) => {
      return !u.is_restricted && !u.is_ultra_restricted && !u.is_bot && !u.deleted
    })
    const reformatted: Channel[] = users.map((user: any) => ({id: user.id, label: `@${user.name}`}))
    return reformatted
  }
}
