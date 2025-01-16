"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeParseJson = safeParseJson;
exports.isMochaRunning = isMochaRunning;
function safeParseJson(str) {
    try {
        return JSON.parse(str ? str : "");
    }
    catch (_a) {
        return undefined;
    }
}
function isMochaRunning() {
    return ["afterEach", "after", "beforeEach", "before", "describe", "it"].every((functionName) => {
        return global[functionName] instanceof Function;
    });
}
