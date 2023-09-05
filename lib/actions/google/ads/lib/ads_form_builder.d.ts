import * as Hub from "../../../../hub";
import { GoogleAdsActionRequest } from "./ads_request";
interface SelectFormOption {
    name: string;
    label: string;
}
interface AdsCustomer {
    resourceName: string;
    manager: boolean;
    descriptiveName: string;
    id: string;
}
export declare class GoogleAdsActionFormBuilder {
    readonly adsRequest: GoogleAdsActionRequest;
    readonly apiClient: import("./api_client").GoogleAdsApiClient;
    readonly createOrAppend: any;
    readonly mobileDevice: any;
    readonly mobileAppId: any;
    readonly isMobileDevice: boolean;
    readonly uploadKeyType: string;
    readonly completedFormParams: any;
    readonly isCreate: boolean;
    readonly loginCid: any;
    readonly targetCid: any;
    readonly targetUserListRN: any;
    loginCustomer?: AdsCustomer;
    targetCustomer?: AdsCustomer;
    constructor(adsRequest: GoogleAdsActionRequest);
    makeForm(): Promise<Hub.ActionForm>;
    loginCidField(): Promise<{
        name: string;
        label: string;
        description: string;
        type: "select";
        options: SelectFormOption[];
        default: string;
        interactive: boolean;
        required: boolean;
    }>;
    targetCidField(): Promise<{
        name: string;
        label: string;
        description: string;
        type: "select";
        options: SelectFormOption[];
        default: string;
        interactive: boolean;
        required: boolean;
    }>;
    createOrAppendField(): {
        name: string;
        label: string;
        description: string;
        type: "select";
        options: {
            name: string;
            label: string;
        }[];
        default: string;
        interactive: boolean;
        required: boolean;
    };
    mobileDeviceField(): {
        name: string;
        label: string;
        description: string;
        type: "select";
        options: {
            name: string;
            label: string;
        }[];
        default: string;
        interactive: boolean;
        required: boolean;
    };
    mobileAppIdField(): {
        name: string;
        label: string;
        description: string;
        type: "string";
        default: string;
        required: boolean;
    };
    newListNameField(): {
        name: string;
        label: string;
        type: "string";
        description: string;
        default: string;
        required: boolean;
    };
    newListDescriptionField(): {
        name: string;
        label: string;
        type: "string";
        description: string;
        default: string;
        required: boolean;
    };
    targetListField(selectOptions: SelectFormOption[]): {
        name: string;
        label: string;
        description: string;
        type: "select";
        options: SelectFormOption[];
        default: string;
        interactive: boolean;
        required: boolean;
    };
    noAvailableListsField(): {
        name: string;
        label: string;
        type: "textarea";
        description: string;
        default: string;
        required: boolean;
    };
    doHashingFormField(): {
        name: string;
        label: string;
        type: "select";
        description: string;
        options: {
            name: string;
            label: string;
        }[];
        default: string;
        required: boolean;
    };
    private maybeSetLoginCustomer;
    private maybeSetTargetCustomer;
    private getLoginCidOptions;
    private getCustomer;
    private getTargetCidOptions;
    private selectOptionForCustomer;
    private sortCustomersCompareFn;
    private getUserListOptions;
}
export {};
