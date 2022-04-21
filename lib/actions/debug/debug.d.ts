import * as Hub from "../../hub";
export declare function registerDebugAction(): void;
export declare class DebugAction extends Hub.Action {
    name: string;
    label: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    supportedFormats: never[];
    params: never[];
    executeInOwnProcess: boolean;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
    private delay;
}
