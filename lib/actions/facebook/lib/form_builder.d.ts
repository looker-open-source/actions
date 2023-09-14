import * as Hub from "../../../hub";
import FacebookCustomAudiencesApi from "./api";
export default class FacebookFormBuilder {
    generateActionForm(actionRequest: Hub.ActionRequest, facebookApi: FacebookCustomAudiencesApi): Promise<Hub.ActionForm>;
    generateOptionsFromNamesAndIds(list: {
        name: string;
        id: string;
    }[]): Promise<{
        name: string;
        label: string;
    }[]>;
    generateLoginForm(actionRequest: Hub.ActionRequest): Promise<Hub.ActionForm>;
}
