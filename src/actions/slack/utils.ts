import {WebClient} from "@slack/web-api"
import * as gaxios from "gaxios"
import * as winston from "winston"
import * as Hub from "../../hub"
import {ActionFormField} from "../../hub"

export const API_LIMIT_SIZE = 1000

interface Channel {
    id: string,
    label: string,
}

const _usableChannels = async (slack: WebClient): Promise<Channel[]> => {
    const options: any = {
        types: "public_channel,private_channel",
        exclude_archived: true,
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
            return pageLoaded(mergedChannels, await slack.conversations.list(pageOptions))
        }
        return mergedChannels
    }
    const channelsInit = await slack.conversations.list(options)
    const paginatedChannels = await pageLoaded([], channelsInit)
    const channels = paginatedChannels.filter((c: any) => !c.is_archived)
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

export const getDisplayedFormFields = async (slack: WebClient, channelType: string): Promise<ActionFormField[]> => {
    let channels: Channel[] = []
    let manualId = false
    if (channelType === "channels") {
        channels = await _usableChannels(slack)
    } else if (channelType === "users") {
        channels = await usableDMs(slack)
    } else {
        manualId = true
    }
    const response: ActionFormField[] = [
        {
            description: "Type of destination to fetch",
            label: "Channel Type",
            name: "channelType",
            options: [
                {name: "manual", label: "Manual Channel ID"},
                {name: "channels", label: "Channels"},
                {name: "users", label: "Users"},
            ],
            default: "manual",
            type: "select",
            interactive: true,
        },
    ]
    // If this is the first load then let the user add a manual ID to send to Slack
    if (manualId) {
        response.push({
            description: "Slack channel or user id",
            label: "Channel or User ID",
            name: "channel",
            type: "string",
        })
    // If the user selected channels or users, send a sorted list of channels
    } else {
        channels.sort((a, b) => ((a.label < b.label) ? -1 : 1 ))
        response.push({
            description: "Name of the Slack channel you would like to post to.",
            label: "Share In",
            name: "channel",
            options: channels.map((channel) => ({ name: channel.id, label: channel.label })),
            required: true,
            type: "select",
        })
    }

    // Always allow comment and filename
    response.push({
        label: "Comment",
        type: "string",
        name: "initial_comment",
    })
    response.push({
        label: "Filename",
        name: "filename",
        type: "string",
    })

    return response
}

export const handleExecute = async (request: Hub.ActionRequest, slack: WebClient): Promise<Hub.ActionResponse> => {
    if (!request.formParams.channel) {
        throw "Missing channel."
    }

    const webhookId = request.webhookId
    const fileName = request.formParams.filename  ? request.completeFilename() : request.suggestedFilename()

    let response = new Hub.ActionResponse({success: true})
    try {
        const isUserToken = request.formParams.channel.startsWith("U") || request.formParams.channel.startsWith("W")
        const forceV1Upload = process.env.FORCE_V1_UPLOAD
        if (!request.empty()) {
            const buffs: any[] = []
            await request.stream(async (readable) => {
                // Slack API Upload flow. Get an Upload URL from slack
                await new Promise<void>((resolve, reject) => {
                    readable.on("readable", () => {
                        let buff = readable.read()
                        while (buff) {
                            buffs.push(buff)
                            buff = readable.read()
                        }
                    })
                    readable.on("end", async () => {
                        const buffer = Buffer.concat(buffs)
                        const comment = request.formParams.initial_comment ? request.formParams.initial_comment : ""
                        winston.info(`Attempting to send ${buffer.byteLength} bytes to Slack`, {webhookId})

                        // Unfortunately UploadV2 does not provide a way to upload files
                        // to user tokens which are common in Looker schedules
                        // (UXXXXXXX)
                        if (isUserToken || forceV1Upload) {
                            winston.info(`V1 Upload of file`, {webhookId})
                            await slack.files.upload({
                                file: buffer,
                                filename: fileName,
                                channels: request.formParams.channel,
                                initial_comment: comment,
                            })
                        } else {
                            winston.info(`V2 Upload of file`, {webhookId})
                            const res = await slack.files.getUploadURLExternal({
                                filename: fileName,
                                length: buffer.byteLength,
                            })
                            const upload_url = res.upload_url

                            // Upload file to Slack
                            await gaxios.request({
                                method: "POST",
                                url: upload_url,
                                data: buffer,
                            })

                            // Finalize upload and give metadata for channel, title and
                            // comment for the file to be posted.
                            await slack.files.completeUploadExternal({
                                files: [{
                                    id: res.file_id ? res.file_id : "",
                                    title: fileName,
                                }],
                                channel_id: request.formParams.channel,
                            }).catch((e: any) => {
                                reject(e)
                            })
                            // Workaround for regression in V2 upload, the initial
                            // comment does not support markdown formatting, breaking
                            // customer links
                            if (comment !== "") {
                                await slack.chat.postMessage({
                                    channel: request.formParams.channel!,
                                    text: comment,
                                }).catch((e: any) => {
                                    reject(e)
                                })
                            }
                        }
                        resolve()
                    })
                })
            })
        } else {
            winston.info("No data to upload. Sending message instead", {webhookId})
            await slack.chat.postMessage({
                channel: request.formParams.channel,
                text: request.formParams.initial_comment ? request.formParams.initial_comment : "",
            })
        }
    } catch (e: any) {
        winston.info(`Error: ${e.message}`)
        response = new Hub.ActionResponse({success: false, message: e.message})
    }
    return response
}

export const displayError: { [key: string]: string; } = {
    "An API error occurred: invalid_auth": "Your Slack authentication credentials are not valid.",
}
