"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REGION = void 0;
exports.logRejection = logRejection;
const winston = require("winston");
exports.DEFAULT_REGION = "us-east-1";
function logRejection(err) {
    winston.debug(err);
}
