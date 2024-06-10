"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHttpErrorType = void 0;
const http_errors_1 = require("./http_errors");
// Input: Error code that can be either a status_code or an http_code
// Output: HttpErrorInfo object containing the correct values for given code
const getHttpErrorType = (code) => {
    // Default to 500 internal server error
    let httpErrorType = http_errors_1.HTTP_ERROR.internal;
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
