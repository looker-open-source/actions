export declare class ActionForm {
    fields: IActionFormField[];
    asJson(): any;
}
export interface IActionFormField {
    name: string;
    label?: string;
    description?: string;
    default?: string;
    type?: "string" | "textarea" | "select";
    options?: {
        name: string;
        label: string;
    }[];
    required?: boolean;
}
