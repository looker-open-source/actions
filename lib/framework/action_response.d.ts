export interface IValidationError {
    field: string;
    message: string;
}
export declare class ActionResponse {
    message: string;
    refreshQuery: boolean;
    success: boolean;
    validationErrors: IValidationError[];
    constructor(fields?: {
        message?: string;
        refreshQuery?: boolean;
        success?: boolean;
        validationErrors?: IValidationError[];
    });
    asJson(): any;
}
