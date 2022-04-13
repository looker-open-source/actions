"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMochaRunning = exports.safeParseJson = void 0;
function safeParseJson(str) {
    try {
        return JSON.parse(str ? str : "");
    }
    catch (_a) {
        return undefined;
    }
}
exports.safeParseJson = safeParseJson;
function isMochaRunning() {
    return ["afterEach", "after", "beforeEach", "before", "describe", "it"].every((functionName) => {
        return global[functionName] instanceof Function;
    });
}
exports.isMochaRunning = isMochaRunning;
