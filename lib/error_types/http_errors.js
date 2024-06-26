"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTP_ERROR = void 0;
exports.HTTP_ERROR = {
    bad_request: {
        status: "BAD_REQUEST",
        code: 400,
        description: "Server cannot process request due to client request error.",
    },
    invalid_argument: {
        status: "INVALID_ARGUMENT",
        code: 400,
        description: "Client specified an invalid argument.",
    },
    failed_precondition: {
        status: "FAILED_PRECONDITION",
        code: 400,
        description: "Request can not be executed in the current system state.",
    },
    unauthenticated: {
        status: "UNAUTHENTICATED",
        code: 401,
        description: "Request not authenticated due to missing, invalid, or expired authentication.",
    },
    permision_denied: {
        status: "PERMISION_DENIED",
        code: 403,
        description: "Client does not have sufficient permission.",
    },
    not_found: {
        status: "NOT_FOUND",
        code: 404,
        description: "Specified resource is not found.",
    },
    request_timeout: {
        status: "REQUEST_TIMEOUT",
        code: 408,
        description: "Request timed out before being able to complete",
    },
    already_exists: {
        status: "ALREADY_EXISTS",
        code: 409,
        description: "The resource that a client tried to create already exists.",
    },
    payload_too_large: {
        status: "PAYLOAD_TOO_LARGE",
        code: 413,
        description: "Request entity is larger than limits defined by server.",
    },
    resource_exhausted: {
        status: "RESOURCE_EXHAUSTED",
        code: 429,
        description: "Either out of resource quota or reaching rate limiting.",
    },
    internal: {
        status: "INTERNAL",
        code: 500,
        description: "Internal server error.",
    },
    internal_connreset: {
        status: "INTERNAL_ECONNRESET",
        code: 500,
        description: "Server has closed the connection while the client was writing data.",
    },
    bad_gateway: {
        status: "BAD_GATEWAY",
        code: 502,
        description: "Server, while working as a gateway to get a response needed to handle the request, got an invalid response.",
    },
    unavailable: {
        status: "UNAVAILABLE",
        code: 503,
        description: "The server is not ready to handle the request.",
    },
    gateway_timeout: {
        status: "GATEWAY_TIMEOUT",
        code: 504,
        description: "Server is acting as a gateway and cannot get a response in time.",
    },
};
