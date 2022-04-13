import * as Hub from "../../hub";
export declare class SFTPAction extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    params: never[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
    private sftpClientFromRequest;
}
