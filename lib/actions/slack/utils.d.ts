import { WebClient } from "@slack/client";
import * as Hub from "../../hub";
import { ActionFormField } from "../../hub";
export declare const API_LIMIT_SIZE = 1000;
export declare const getDisplayedFormFields: (slack: WebClient) => Promise<ActionFormField[]>;
export declare const handleExecute: (request: Hub.ActionRequest, slack: WebClient) => Promise<Hub.ActionResponse>;
export declare const displayError: {
    [key: string]: string;
};
