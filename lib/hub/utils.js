"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatToFileExtension = exports.truncateString = void 0;
function truncateString(s, limit, split = "\n") {
    if (s.length > limit) {
        // truncate to max limit characters
        s = s.substring(0, limit);
        // re-trim if we are in the middle of a line
        if (s.lastIndexOf(split) > 0) {
            s = s.substring(0, Math.min(s.length, s.lastIndexOf(split) + 1));
        }
    }
    return s;
}
exports.truncateString = truncateString;
function formatToFileExtension(format) {
    const JSON_LIKE = ["json", "json_label", "inline_json", "json_detail"];
    if (JSON_LIKE.indexOf(format) !== -1) {
        return "json";
    }
    else {
        return format;
    }
}
exports.formatToFileExtension = formatToFileExtension;
