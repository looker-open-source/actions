import * as Hub from "../../../hub";
type HubTypes = Hub.ActionResponse | Hub.ActionForm;
export declare class WrappedResponse<T extends HubTypes> {
    errorPrefix: string;
    private _hubResp;
    constructor(klass: new () => T);
    set form(form: T);
    returnError(err: Error): T;
    returnSuccess(userState?: any): T;
    setError(err: Error): void;
    resetState(): void;
    setUserState(userState: any): void;
}
export {};
