"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayError = exports.handleExecute = exports.getDisplayedFormFields = exports.API_LIMIT_SIZE = void 0;
const gaxios = require("gaxios");
const winston = require("winston");
const Hub = require("../../hub");
exports.API_LIMIT_SIZE = 1000;
const _usableChannels = (slack) => __awaiter(void 0, void 0, void 0, function* () {
    const options = {
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: exports.API_LIMIT_SIZE,
    };
    const pageLoaded = (accumulatedChannels, response) => __awaiter(void 0, void 0, void 0, function* () {
        const mergedChannels = accumulatedChannels.concat(response.channels);
        // When a `next_cursor` exists, recursively call this function to get the next page.
        if (response.response_metadata &&
            response.response_metadata.next_cursor &&
            response.response_metadata.next_cursor !== "") {
            const pageOptions = Object.assign({}, options);
            pageOptions.cursor = response.response_metadata.next_cursor;
            return pageLoaded(mergedChannels, yield slack.conversations.list(pageOptions));
        }
        return mergedChannels;
    });
    const channelsInit = yield slack.conversations.list(options);
    const paginatedChannels = yield pageLoaded([], channelsInit);
    const channels = paginatedChannels.filter((c) => !c.is_archived);
    return channels.map((channel) => ({ id: channel.id, label: `#${channel.name}` }));
});
const usableDMs = (slack) => __awaiter(void 0, void 0, void 0, function* () {
    const options = {
        limit: exports.API_LIMIT_SIZE,
    };
    function pageLoaded(accumulatedUsers, response) {
        return __awaiter(this, void 0, void 0, function* () {
            const mergedUsers = accumulatedUsers.concat(response.members);
            // When a `next_cursor` exists, recursively call this function to get the next page.
            if (response.response_metadata &&
                response.response_metadata.next_cursor &&
                response.response_metadata.next_cursor !== "") {
                const pageOptions = Object.assign({}, options);
                pageOptions.cursor = response.response_metadata.next_cursor;
                return pageLoaded(mergedUsers, yield slack.users.list(pageOptions));
            }
            return mergedUsers;
        });
    }
    const paginatedUsers = yield pageLoaded([], yield slack.users.list(options));
    const users = paginatedUsers.filter((u) => {
        return !u.is_restricted && !u.is_ultra_restricted && !u.is_bot && !u.deleted;
    });
    return users.map((user) => ({ id: user.id, label: `@${user.name}` }));
});
const getDisplayedFormFields = (slack, channelType) => __awaiter(void 0, void 0, void 0, function* () {
    let channels;
    if (channelType === "channels") {
        channels = yield _usableChannels(slack);
    }
    else {
        channels = yield usableDMs(slack);
    }
    channels.sort((a, b) => ((a.label < b.label) ? -1 : 1));
    return [
        {
            description: "Type of destination to fetch",
            label: "Channel Type",
            name: "channelType",
            options: [{ name: "channels", label: "Channels" }, { name: "users", label: "Users" }],
            type: "select",
            default: "channels",
            interactive: true,
        },
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
        },
    ];
});
exports.getDisplayedFormFields = getDisplayedFormFields;
const handleExecute = (request, slack) => __awaiter(void 0, void 0, void 0, function* () {
    if (!request.formParams.channel) {
        throw "Missing channel.";
    }
    const fileName = request.formParams.filename ? request.completeFilename() : request.suggestedFilename();
    let response = new Hub.ActionResponse({ success: true });
    try {
        if (!request.empty()) {
            const buffs = [];
            yield request.stream((readable) => __awaiter(void 0, void 0, void 0, function* () {
                // Slack API Upload flow. Get an Upload URL from slack
                yield new Promise((resolve, reject) => {
                    readable.on("readable", () => {
                        let buff = readable.read();
                        while (buff) {
                            buffs.push(buff);
                            buff = readable.read();
                        }
                    });
                    readable.on("end", () => __awaiter(void 0, void 0, void 0, function* () {
                        const buffer = Buffer.concat(buffs);
                        const res = yield slack.files.getUploadURLExternal({
                            filename: fileName,
                            length: buffer.byteLength,
                        });
                        const upload_url = res.upload_url;
                        // Upload file to Slack
                        yield gaxios.request({
                            method: "POST",
                            url: upload_url,
                            data: buffer,
                        });
                        // Finalize upload and give metadata for channel, title and comment for the file to be posted.
                        yield slack.files.completeUploadExternal({
                            files: [{
                                    id: res.file_id ? res.file_id : "",
                                }],
                            channel_id: request.formParams.channel,
                            initial_comment: request.formParams.initial_comment ? request.formParams.initial_comment : "",
                        }).catch((e) => {
                            reject(e);
                        });
                        resolve();
                    }));
                });
            }));
        }
        else {
            winston.info("No data to upload. Sending message instead");
            yield slack.chat.postMessage({
                channel: request.formParams.channel,
                text: request.formParams.initial_comment ? request.formParams.initial_comment : "",
            });
        }
    }
    catch (e) {
        winston.info(`Error: ${e.message}`);
        response = new Hub.ActionResponse({ success: false, message: e.message });
    }
    return response;
});
exports.handleExecute = handleExecute;
exports.displayError = {
    "An API error occurred: invalid_auth": "Your Slack authentication credentials are not valid.",
};
