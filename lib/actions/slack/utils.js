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
const winston = require("winston");
const Hub = require("../../hub");
exports.API_LIMIT_SIZE = 1000;
const _usableChannels = (slack) => __awaiter(void 0, void 0, void 0, function* () {
    const options = {
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: exports.API_LIMIT_SIZE,
    };
    const channelList = slack.conversations.list;
    const pageLoaded = (accumulatedChannels, response) => __awaiter(void 0, void 0, void 0, function* () {
        const mergedChannels = accumulatedChannels.concat(response.channels);
        // When a `next_cursor` exists, recursively call this function to get the next page.
        if (response.response_metadata &&
            response.response_metadata.next_cursor &&
            response.response_metadata.next_cursor !== "") {
            const pageOptions = Object.assign({}, options);
            pageOptions.cursor = response.response_metadata.next_cursor;
            return pageLoaded(mergedChannels, yield channelList(pageOptions));
        }
        return mergedChannels;
    });
    const paginatedChannels = yield pageLoaded([], yield channelList(options));
    const channels = paginatedChannels.filter((c) => c.is_member && !c.is_archived);
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
exports.getDisplayedFormFields = (slack, channelType) => __awaiter(void 0, void 0, void 0, function* () {
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
exports.handleExecute = (request, slack) => __awaiter(void 0, void 0, void 0, function* () {
    if (!request.formParams.channel) {
        throw "Missing channel.";
    }
    const fileName = request.formParams.filename ? request.completeFilename() : request.suggestedFilename();
    let response = new Hub.ActionResponse({ success: true });
    try {
        if (!request.empty()) {
            yield request.stream((readable) => __awaiter(void 0, void 0, void 0, function* () {
                yield slack.files.upload({
                    file: readable,
                    filename: fileName,
                    channels: request.formParams.channel,
                    initial_comment: request.formParams.initial_comment ? request.formParams.initial_comment : "",
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
        response = new Hub.ActionResponse({ success: false, message: e.message });
    }
    return response;
});
exports.displayError = {
    "An API error occurred: invalid_auth": "Your Slack authentication credentials are not valid.",
};
