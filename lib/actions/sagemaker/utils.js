"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logRejection = exports.DEFAULT_REGION = void 0;
const winston = require("winston");
exports.DEFAULT_REGION = "us-east-1";
function logRejection(err) {
    winston.debug(err);
}
exports.logRejection = logRejection;
