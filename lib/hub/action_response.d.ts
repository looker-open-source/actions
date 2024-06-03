import { ActionState } from "./action_state";
import { HttpErrorInfo } from '../error_types/http_errors';
export interface ValidationError {
    field: string;
    message: string;
}
export interface Error {
    http_code: number;
    status_code: string;
    message: string;
    location: string;
    documentation_url: string;
}
export declare function errorWith(errorInfo: HttpErrorInfo, message: string): Error;
export declare class ActionResponse {
    message?: string;
    refreshQuery: boolean;
    success: boolean;
    validationErrors: ValidationError[];
    state?: ActionState;
    error?: Error;
    webhookId?: string;
    constructor(fields?: {
        message?: string;
        refreshQuery?: boolean;
        success?: boolean;
        validationErrors?: ValidationError[];
        error?: Error;
        webhookId?: string;
    });
    asJson(): any;
}
