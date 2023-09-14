import * as Hub from "../../hub";
export declare class QueueTestAction extends Hub.Action {
    name: string;
    label: string;
    description: string;
    params: never[];
    supportedActionTypes: Hub.ActionType[];
    executeInOwnProcess: boolean;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
}
