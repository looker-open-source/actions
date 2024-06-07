"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatErrorCode = void 0;
const http_errors_1 = require("./http_errors");
// Input: Error code that can be either a status_code or an http_code
// Output: HttpErrorInfo object containing the correct values for given code
const formatErrorCode = (code) => {
    // Default to 500 internal server error
    let formattedErrorInfo = {
        status: http_errors_1.HTTP_ERROR.internal.status,
        code: http_errors_1.HTTP_ERROR.internal.code,
        description: `${http_errors_1.HTTP_ERROR.internal.description} Error Format util`,
    };
    // if input is a number we want to find the corresponding error code and set
    // the values based on that code
    if (!isNaN(+code)) { // if e.code is not not a number; if e.code is a number
        Object.values(http_errors_1.HTTP_ERROR).forEach((errorType) => {
            // if code is a number, set default code in case we haven't defined that specific code
            formattedErrorInfo = Object.assign(Object.assign({}, formattedErrorInfo), { code: +code });
            if (+code === errorType.code) {
                formattedErrorInfo = {
                    status: errorType.status,
                    code: errorType.code,
                    description: errorType.description,
                };
            }
        });
        // if input is a string, find corresponding error status and set
        // the values based on the status
    }
    else if (typeof code === "string" || code instanceof String) {
        // if code is not a number, set default status to given status in case
        // we don't have that particular status defined
        formattedErrorInfo = Object.assign(Object.assign({}, formattedErrorInfo), { status: code.toString() });
        Object.values(http_errors_1.HTTP_ERROR).forEach((errorType) => {
            if (code === errorType.status) {
                formattedErrorInfo = {
                    status: errorType.status,
                    code: errorType.code,
                    description: errorType.description,
                };
            }
        });
    }
    return formattedErrorInfo;
};
exports.formatErrorCode = formatErrorCode;
