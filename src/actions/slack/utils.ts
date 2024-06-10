import {ErrorCode, WebClient} from "@slack/web-api"
import * as gaxios from "gaxios"
import * as winston from "winston"
import { HTTP_ERROR } from "../../error_types/http_errors"
import * as Hub from "../../hub"
import {ActionFormField} from "../../hub"
import { Error, errorWith } from "../../hub/action_response"

export const API_LIMIT_SIZE = 1000

const LOG_PREFIX = "[SLACK]"

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
    const response = new Hub.ActionResponse({success: true})
    if (!request.formParams.channel) {
        const error: Error = {
            http_code: HTTP_ERROR.bad_request.code,
            status_code: HTTP_ERROR.bad_request.status,
            message: `${HTTP_ERROR.bad_request.description} ${LOG_PREFIX} Missing channel`,
            location: "ActionContainer",
            documentation_url: "TODO",
        }
        response.error = error
        response.message = error.message
        response.webhookId = request.webhookId
        response.success = false

        winston.error(`${error.message}`, {error, webhookId: request.webhookId})
        return response
    }

    const webhookId = request.webhookId
    const fileName = request.formParams.filename  ? request.completeFilename() : request.suggestedFilename()

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
                        winston.info(
                            `${LOG_PREFIX} Attempting to send ${buffer.byteLength} bytes to Slack`,
                            {webhookId},
                        )

                        // Unfortunately UploadV2 does not provide a way to upload files
                        // to user tokens which are common in Looker schedules
                        // (UXXXXXXX)
                        if (isUserToken || forceV1Upload) {
                            winston.info(`${LOG_PREFIX} V1 Upload of file`, {webhookId})
                            await slack.files.upload({
                                file: buffer,
                                filename: fileName,
                                channels: request.formParams.channel,
                                initial_comment: comment,
                            })
                        } else {
                            winston.info(`${LOG_PREFIX} V2 Upload of file`, {webhookId})
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
                                winston.error(`${LOG_PREFIX} ${e.message}`, {webhookId})
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
                                    winston.error(`${LOG_PREFIX} ${e.message}`, {webhookId})
                                    reject(e)
                                })
                            }
                        }
                        resolve()
                    })
                })
            })
        } else {
            winston.info(`${LOG_PREFIX} No data to upload. Sending message instead`, {webhookId})
            await slack.chat.postMessage({
                channel: request.formParams.channel,
                text: request.formParams.initial_comment ? request.formParams.initial_comment : "",
            })
        }
    } catch (e: any) {
        let error: Error = errorWith(
            HTTP_ERROR.internal,
            `${LOG_PREFIX} Error while sending data ${e.message}`,
        )
        if (e.code) {
            if (e.code === ErrorCode.PlatformError) {
                error = errorWith(
                    HTTP_ERROR.internal,
                    `${LOG_PREFIX} errored with WebPlatformError ${e.data.error}`,
                )
            } else if (e.code === ErrorCode.RequestError) {
                error = errorWith(
                    HTTP_ERROR.bad_request,
                    `${LOG_PREFIX} errored with RequestError ${e.original}`,
                )
            } else if (e.code === ErrorCode.HTTPError) {
                error = errorWith(
                    {status: e.status, code: e.code, description: "HTTP request error"},
                    `${LOG_PREFIX} errored with HTTPError ${e.statusMessage}`,
                )
            } else if (e.code === ErrorCode.RateLimitedError) {
                error = errorWith(
                    HTTP_ERROR.resource_exhausted,
                    `${LOG_PREFIX} errored with RateLimitedError`,
                )
            } else if (e.code === ErrorCode.FileUploadInvalidArgumentsError) {
                error = errorWith(
                    HTTP_ERROR.invalid_argument,
                    `${LOG_PREFIX} errored with InvalidArgumentsError ${e.data.error}`,
                )
            }
        }

        response.error = error
        response.webhookId = request.webhookId
        response.success = false
        response.message = error.message

        winston.error(`${response.message}`, {error, webhookId: request.webhookId})
    }
    return response
}

export const displayError: { [key: string]: string; } = {
    "An API error occurred: invalid_auth": "Your Slack authentication credentials are not valid.",
}
