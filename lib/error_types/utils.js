"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHttpErrorType = void 0;
const http_errors_1 = require("./http_errors");
// Input: Error of type any, Name of action calling this method
// Output: HttpErrorInfo object containing the correct values for given code
const getHttpErrorType = (e, actionName) => {
    // Default to 500 internal server error
    let httpErrorType = http_errors_1.HTTP_ERROR.internal;
    // Checks google actions for google specific errors and sets default type
    if (actionName.includes("google")) {
        httpErrorType = getGoogleHttpErrorType(e);
        // if error is not default we have found and set an error type already, return it
        if (httpErrorType !== http_errors_1.HTTP_ERROR.internal) {
            return httpErrorType;
        }
    }
    // Checks to ensure e.code exists otherwise return default error type
    let code;
    if (e.code) {
        code = e.code;
    }
    else {
        return httpErrorType;
    }
    // if input is a number we want to find the corresponding error code and set
    // the values based on that code
    if (!isNaN(+code)) { // if e.code is not not a number; if e.code is a number
        Object.values(http_errors_1.HTTP_ERROR).forEach((errorType) => {
            // if code is a number, set default code in case we haven't defined that specific code
            httpErrorType = Object.assign(Object.assign({}, httpErrorType), { code: +code });
            if (+code === errorType.code) {
                httpErrorType = errorType;
            }
        });
        // if input is a string, find corresponding error status and set
        // the values based on the status
    }
    else if (typeof code === "string" || code instanceof String) {
        // if code is not a number, set default status to given status in case
        // we don't have that particular status defined
        httpErrorType = Object.assign(Object.assign({}, httpErrorType), { status: code.toString() });
        Object.values(http_errors_1.HTTP_ERROR).forEach((errorType) => {
            if (code === errorType.status) {
                httpErrorType = errorType;
            }
        });
    }
    return httpErrorType;
};
exports.getHttpErrorType = getHttpErrorType;
// Google sheets, drive, storage all return error messages but do not return status codes
// this function takes the error message and returns the correct status code and status string.
// Previously would always return 500 INTERAL_SERVER.
const getGoogleHttpErrorType = (e) => {
    let httpErrorType;
    let googleErrorMessage;
    if (e.errors && e.errors[0] && e.errors[0].message) {
        googleErrorMessage = e.errors[0].message.toLowerCase();
    }
    else if (e.message) {
        googleErrorMessage = e.message.toLowerCase();
    }
    else {
        googleErrorMessage = e.toString().toLowerCase();
    }
    if (googleErrorMessage.includes("invalid opening quote")) {
        httpErrorType = http_errors_1.HTTP_ERROR.bad_request;
    }
    else if (googleErrorMessage.includes("invalid_grant")) {
        httpErrorType = http_errors_1.HTTP_ERROR.unauthenticated;
    }
    else if (googleErrorMessage.includes("invalid record length")) {
        httpErrorType = http_errors_1.HTTP_ERROR.bad_request;
    }
    else if (googleErrorMessage.includes("file not found")) {
        httpErrorType = http_errors_1.HTTP_ERROR.not_found;
    }
    else if (googleErrorMessage.includes("insufficient permissions")) {
        httpErrorType = http_errors_1.HTTP_ERROR.permision_denied;
    }
    else if (googleErrorMessage.includes("invalid value")) {
        httpErrorType = http_errors_1.HTTP_ERROR.invalid_argument;
    }
    else if (googleErrorMessage.includes("etimedout")) {
        httpErrorType = http_errors_1.HTTP_ERROR.request_timeout;
    }
    else if (googleErrorMessage.includes("invalid request")) {
        httpErrorType = http_errors_1.HTTP_ERROR.bad_request;
    }
    else if (googleErrorMessage.includes("esockettimedout")) {
        httpErrorType = http_errors_1.HTTP_ERROR.internal_connreset;
    }
    else if (googleErrorMessage.includes("aborted")) {
        httpErrorType = http_errors_1.HTTP_ERROR.internal_connreset;
    }
    else if (googleErrorMessage.includes("read econnreset")) {
        httpErrorType = http_errors_1.HTTP_ERROR.internal_connreset;
    }
    else if (googleErrorMessage.includes("write econnreset")) {
        httpErrorType = http_errors_1.HTTP_ERROR.internal_connreset;
    }
    else if (googleErrorMessage.includes("could not authenticate request")) {
        httpErrorType = http_errors_1.HTTP_ERROR.unauthenticated;
    }
    else if (googleErrorMessage.includes("socket hang up")) {
        httpErrorType = http_errors_1.HTTP_ERROR.internal_connreset;
    }
    else if (googleErrorMessage.includes("the caller does not have permission")) {
        httpErrorType = http_errors_1.HTTP_ERROR.permision_denied;
    }
    else if (googleErrorMessage.includes("cannot send more than")) {
        httpErrorType = http_errors_1.HTTP_ERROR.bad_request;
    }
    else if (googleErrorMessage.includes("the service is currently unavailable")) {
        httpErrorType = http_errors_1.HTTP_ERROR.unavailable;
    }
    else {
        httpErrorType = http_errors_1.HTTP_ERROR.internal;
    }
    return httpErrorType;
};
