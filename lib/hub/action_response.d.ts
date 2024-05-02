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
export declare class ActionResponse {
    message?: string;
    refreshQuery: boolean;
    success: boolean;
    validationErrors: ValidationError[];
    state?: ActionState;
    errors?: Error[];
    webhookId?: string;
    constructor(fields?: {
        message?: string;
        refreshQuery?: boolean;
        success?: boolean;
        validationErrors?: ValidationError[];
        errors?: Error[];
        webhookId?: string;
    });
    asJson(): any;
}
