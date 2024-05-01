import { HttpErrorInfo } from "../error_types/http_errors";
import { ActionState } from "./action_state";
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
<<<<<<< HEAD
export declare function errorWith(errorInfo: HttpErrorInfo, message: string): Error;
=======
>>>>>>> 47a1a25 (First sweep at adding dynamic hostname verification)
export declare class ActionResponse {
    message?: string;
    refreshQuery: boolean;
    success: boolean;
    validationErrors: ValidationError[];
    state?: ActionState;
<<<<<<< HEAD
    error?: Error;
=======
    errors?: Error[];
>>>>>>> 47a1a25 (First sweep at adding dynamic hostname verification)
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
