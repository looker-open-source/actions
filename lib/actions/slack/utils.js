"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayError = exports.handleExecute = exports.getDisplayedFormFields = exports.API_LIMIT_SIZE = void 0;
const web_api_1 = require("@slack/web-api");
const gaxios = require("gaxios");
const winston = require("winston");
const http_errors_1 = require("../../error_types/http_errors");
const Hub = require("../../hub");
const action_response_1 = require("../../hub/action_response");
exports.API_LIMIT_SIZE = 1000;
const LOG_PREFIX = "[SLACK]";
const _usableChannels = async (slack) => {
    const options = {
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: exports.API_LIMIT_SIZE,
    };
    const pageLoaded = async (accumulatedChannels, response) => {
        const mergedChannels = accumulatedChannels.concat(response.channels);
        // When a `next_cursor` exists, recursively call this function to get the next page.
        if (response.response_metadata &&
            response.response_metadata.next_cursor &&
            response.response_metadata.next_cursor !== "") {
            const pageOptions = { ...options };
            pageOptions.cursor = response.response_metadata.next_cursor;
            return pageLoaded(mergedChannels, await slack.conversations.list(pageOptions));
        }
        return mergedChannels;
    };
    const channelsInit = await slack.conversations.list(options);
    const paginatedChannels = await pageLoaded([], channelsInit);
    const channels = paginatedChannels.filter((c) => !c.is_archived);
    return channels.map((channel) => ({ id: channel.id, label: `#${channel.name}` }));
};
const usableDMs = async (slack) => {
    const options = {
        limit: exports.API_LIMIT_SIZE,
    };
    async function pageLoaded(accumulatedUsers, response) {
        const mergedUsers = accumulatedUsers.concat(response.members);
        // When a `next_cursor` exists, recursively call this function to get the next page.
        if (response.response_metadata &&
            response.response_metadata.next_cursor &&
            response.response_metadata.next_cursor !== "") {
            const pageOptions = { ...options };
            pageOptions.cursor = response.response_metadata.next_cursor;
            return pageLoaded(mergedUsers, await slack.users.list(pageOptions));
        }
        return mergedUsers;
    }
    const paginatedUsers = await pageLoaded([], await slack.users.list(options));
    const users = paginatedUsers.filter((u) => {
        return !u.is_restricted && !u.is_ultra_restricted && !u.is_bot && !u.deleted;
    });
    return users.map((user) => ({ id: user.id, label: `@${user.name}` }));
};
const getDisplayedFormFields = async (slack, channelType) => {
    let channels = [];
    let manualId = false;
    if (channelType === "channels") {
        channels = await _usableChannels(slack);
    }
    else if (channelType === "users") {
        channels = await usableDMs(slack);
    }
    else {
        manualId = true;
    }
    const response = [
        {
            description: "Type of destination to fetch",
            label: "Channel Type",
            name: "channelType",
            options: [
                { name: "manual", label: "Manual Channel ID" },
                { name: "channels", label: "Channels" },
                { name: "users", label: "Users" },
            ],
            default: "manual",
            type: "select",
            interactive: true,
        },
    ];
    // If this is the first load then let the user add a manual ID to send to Slack
    if (manualId) {
        response.push({
            description: "Slack channel or user id",
            label: "Channel or User ID",
            name: "channel",
            type: "string",
        });
        // If the user selected channels or users, send a sorted list of channels
    }
    else {
        channels.sort((a, b) => ((a.label < b.label) ? -1 : 1));
        response.push({
            description: "Name of the Slack channel you would like to post to.",
            label: "Share In",
            name: "channel",
            options: channels.map((channel) => ({ name: channel.id, label: channel.label })),
            required: true,
            type: "select",
        });
    }
    // Always allow comment and filename
    response.push({
        label: "Comment",
        type: "string",
        name: "initial_comment",
    });
    response.push({
        label: "Filename",
        name: "filename",
        type: "string",
    });
    return response;
};
exports.getDisplayedFormFields = getDisplayedFormFields;
const handleExecute = async (request, slack) => {
    const response = new Hub.ActionResponse({ success: true });
    if (!request.formParams.channel) {
        const error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.bad_request, `${LOG_PREFIX} Missing channel`);
        response.error = error;
        response.message = error.message;
        response.webhookId = request.webhookId;
        response.success = false;
        winston.error(`${error.message}`, { error, webhookId: request.webhookId });
        return response;
    }
    const webhookId = request.webhookId;
    const fileName = request.formParams.filename ? request.completeFilename() : request.suggestedFilename();
    try {
        const isUserToken = request.formParams.channel.startsWith("U") || request.formParams.channel.startsWith("W");
        const channel = request.formParams.channel;
        if (!request.empty()) {
            const buffs = [];
            await request.stream(async (readable) => {
                // Slack API Upload flow. Get an Upload URL from slack
                await new Promise((resolve, reject) => {
                    readable.on("readable", () => {
                        let buff = readable.read();
                        while (buff) {
                            buffs.push(buff);
                            buff = readable.read();
                        }
                    });
                    readable.on("end", async () => {
                        const buffer = Buffer.concat(buffs);
                        const comment = request.formParams.initial_comment ? request.formParams.initial_comment : "";
                        winston.info(`${LOG_PREFIX} Attempting to send ${buffer.byteLength} bytes to Slack`, { webhookId });
                        winston.info(`${LOG_PREFIX} V2 Upload of file`, { webhookId });
                        const res = await slack.files.getUploadURLExternal({
                            filename: fileName,
                            length: buffer.byteLength,
                        });
                        const upload_url = res.upload_url;
                        // Upload file to Slack
                        await gaxios.request({
                            method: "POST",
                            url: upload_url,
                            data: buffer,
                        });
                        // Finalize upload and give metadata for channel, title and
                        // comment for the file to be posted.
                        if (isUserToken) {
                            //  If we have a user token, we need to convert the
                            //  UXXXXX token into a DXXXXX token. Conversations.open()
                            //  requires channels:manage and extra *:write scopes
                            //  which will break existing schedules. Posting a message
                            //  first only requires chat:write which we already have.
                            //  the response returns a DXXXX token which we can use
                            //  to upload to the channel
                            const postResponse = await slack.chat.postMessage({
                                channel,
                                text: comment.length !== 0 ? comment : "Looker Data",
                            }).catch((e) => {
                                winston.error("Issue posting message", { webhookId });
                                reject(e);
                            });
                            const directChannel = postResponse === null || postResponse === void 0 ? void 0 : postResponse.channel;
                            await slack.files.completeUploadExternal({
                                files: [{
                                        id: res.file_id ? res.file_id : "",
                                        title: fileName,
                                    }],
                                channel_id: directChannel,
                            }).catch((e) => {
                                winston.error(`${LOG_PREFIX} ${e.message}`, { webhookId });
                                reject(e);
                            });
                        }
                        else {
                            await slack.files.completeUploadExternal({
                                files: [{
                                        id: res.file_id ? res.file_id : "",
                                        title: fileName,
                                    }],
                                channel_id: channel,
                            }).catch((e) => {
                                winston.error(`${LOG_PREFIX} ${e.message}`, { webhookId });
                                reject(e);
                            });
                            // Workaround for regression in V2 upload, the initial
                            // comment does not support markdown formatting, breaking
                            // customer links
                            if (comment !== "") {
                                await slack.chat.postMessage({
                                    channel,
                                    text: comment,
                                }).catch((e) => {
                                    winston.error(`${LOG_PREFIX} ${e.message}`, { webhookId });
                                    reject(e);
                                });
                            }
                        }
                        resolve();
                    });
                });
            });
        }
        else {
            winston.info(`${LOG_PREFIX} No data to upload. Sending message instead`, { webhookId });
            await slack.chat.postMessage({
                channel: request.formParams.channel,
                text: request.formParams.initial_comment ? request.formParams.initial_comment : "",
            });
        }
    }
    catch (e) {
        let error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.internal, `${LOG_PREFIX} Error while sending data ${e.message}`);
        if (e.code) {
            if (e.code === web_api_1.ErrorCode.PlatformError) {
                error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.bad_request, `${LOG_PREFIX} errored with WebPlatformError ${e.data.error}`);
            }
            else if (e.code === web_api_1.ErrorCode.RequestError) {
                error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.bad_request, `${LOG_PREFIX} errored with RequestError ${e.original}`);
            }
            else if (e.code === web_api_1.ErrorCode.HTTPError) {
                error = (0, action_response_1.errorWith)({ status: e.status, code: e.code, description: "HTTP request error" }, `${LOG_PREFIX} errored with HTTPError ${e.statusMessage}`);
            }
            else if (e.code === web_api_1.ErrorCode.RateLimitedError) {
                error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.resource_exhausted, `${LOG_PREFIX} errored with RateLimitedError`);
            }
            else if (e.code === web_api_1.ErrorCode.FileUploadInvalidArgumentsError) {
                error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.invalid_argument, `${LOG_PREFIX} errored with InvalidArgumentsError ${e.data.error}`);
            }
        }
        response.error = error;
        response.webhookId = request.webhookId;
        response.success = false;
        response.message = error.message;
        winston.error(`${response.message}`, { error, webhookId: request.webhookId });
    }
    return response;
};
exports.handleExecute = handleExecute;
exports.displayError = {
    "An API error occurred: invalid_auth": "Your Slack authentication credentials are not valid.",
};
