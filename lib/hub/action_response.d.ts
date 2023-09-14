import { ActionState } from "./action_state";
export interface ValidationError {
    field: string;
    message: string;
}
export declare class ActionResponse {
    message?: string;
    refreshQuery: boolean;
    success: boolean;
    validationErrors: ValidationError[];
    state?: ActionState;
    constructor(fields?: {
        message?: string;
        refreshQuery?: boolean;
        success?: boolean;
        validationErrors?: ValidationError[];
    });
    asJson(): any;
}
