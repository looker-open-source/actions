export declare const HTTP_ERROR: {
    bad_request: {
        status: string;
        code: number;
        description: string;
    };
    invalid_argument: {
        status: string;
        code: number;
        description: string;
    };
    failed_precondition: {
        status: string;
        code: number;
        description: string;
    };
    unauthenticated: {
        status: string;
        code: number;
        description: string;
    };
    permision_denied: {
        status: string;
        code: number;
        description: string;
    };
    not_found: {
        status: string;
        code: number;
        description: string;
    };
    request_timeout: {
        status: string;
        code: number;
        description: string;
    };
    already_exists: {
        status: string;
        code: number;
        description: string;
    };
    payload_too_large: {
        status: string;
        code: number;
        description: string;
    };
    resource_exhausted: {
        status: string;
        code: number;
        description: string;
    };
    internal: {
        status: string;
        code: number;
        description: string;
    };
    bad_gateway: {
        status: string;
        code: number;
        description: string;
    };
    unavailable: {
        status: string;
        code: number;
        description: string;
    };
    gateway_timeout: {
        status: string;
        code: number;
        description: string;
    };
};
export interface HttpErrorInfo {
    status: string;
    code: number;
    description: string;
}
