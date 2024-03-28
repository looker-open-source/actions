import { ActionState } from "./action_state";
export interface ValidationError {
    field: string;
    message: string;
}

export interface Errors {
    /* error code associated with the error */
    http_code: number
    /* The enum version of the http_code */
    status_code: string
    /* Detailed description of error written by us, this should give the reason it happened and a plausible fix, and specify who is at fault */
    message: string
    /* where in the service the failure occurred, which action was running when it erred */
    location: string
    /* url to help page listing the errors and giving detailed information about each */
    documentation_url: string
  }

export declare class ActionResponse {
    message?: string;
    refreshQuery: boolean;
    success: boolean;
    validationErrors: ValidationError[];
    state?: ActionState;
    errors: Errors[];
    webhookId: string;
    constructor(fields?: {
        message?: string;
        refreshQuery?: boolean;
        success?: boolean;
        validationErrors?: ValidationError[];
        errors?: Errors[];
        webhookId?: string;
    });
    asJson(): any;
}
