import {WebClient} from "@slack/client"
import * as Hub from "../../hub";
import {ActionFormField} from "../../hub"

export const API_LIMIT_SIZE = 1000

interface Channel {
    id: string,
    label: string,
}

const usablePublicChannels = async (slack: WebClient): Promise<Channel[]> => {
    const options: any = {
        exclude_archived: true,
        exclude_members: true,
        limit: API_LIMIT_SIZE,
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
    return channels.map((channel: any) => ({id: channel.id, label: `#${channel.name}`}))
}

const usableDMs = async (slack: WebClient): Promise<Channel[]> => {
    const options: any = {
        limit: API_LIMIT_SIZE,
    }
    async function pageLoaded(accumulatedUsers: any[], response: any): Promise<any[]> {
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
    return users.map((user: any) => ({id: user.id, label: `@${user.name}`}))
}

const usableChannels = async (slack: WebClient): Promise<Channel[]> => {
    let channels = await usablePublicChannels(slack)
    channels = channels.concat(await usableDMs(slack))
    channels.sort((a, b) => ((a.label < b.label) ? -1 : 1 ))
    return channels
}

export const getDisplayedFormFields = async (slack: WebClient): Promise<ActionFormField[]> => {
    const channels = await usableChannels(slack)
    return [
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
        }
    ]
}

export const handleExecute = async (request: Hub.ActionRequest, slack: WebClient): Promise<Hub.ActionResponse> => {
    /**
     * So the below logic is the streaming logic grab from https://github.com/looker/actions/pull/255
     * I know it worked at some point but is no longer the case.
     */
    // if (!request.formParams.channel) {
    //     throw "Missing channel."
    // }
    //
    // const fileName = request.formParams.filename || request.suggestedFilename()
    //
    // let response = new Hub.ActionResponse({success: true})
    // try {
    //     await request.stream(async (readable) => {
    //         await slack.files.upload({
    //             file: readable,
    //             filename: fileName,
    //             channels: request.formParams.channel,
    //             initial_comment: request.formParams.initial_comment ? request.formParams.initial_comment : "",
    //         })
    //     })
    // } catch (e) {
    //     response = new Hub.ActionResponse({success: false, message: e.message})
    // }
    // return response

    /**
     * So the below logic is the non streaming logic that is currently in master
     */
    if (!request.attachment || !request.attachment.dataBuffer) {
        throw "Couldn't get data from attachment."
    }

    if (!request.formParams.channel) {
        throw "Missing channel."
    }

    const fileName = request.formParams.filename || request.suggestedFilename()

    const options = {
        file: request.attachment.dataBuffer,
        filename: fileName,
        channels: request.formParams.channel,
        filetype: request.attachment.fileExtension,
        initial_comment: request.formParams.initial_comment ? request.formParams.initial_comment : "",
    }

    let response
    try {
        await new Promise<void>((resolve, reject) => {
            slack.files.upload(options, (err: any) => {
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

export const displayError: { [key: string]: string; } = {
    "An API error occurred: invalid_auth": "Your Slack authentication credentials are not valid.",
}
