"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsActionFormBuilder = void 0;
const Hub = require("../../../../hub");
const CREATE_LIST_OPTION_NAME = "create";
class GoogleAdsActionFormBuilder {
    constructor(adsRequest) {
        this.adsRequest = adsRequest;
        this.apiClient = this.adsRequest.apiClient;
        this.createOrAppend = this.adsRequest.createOrAppend;
        this.mobileDevice = this.adsRequest.mobileDevice;
        this.mobileAppId = this.adsRequest.mobileAppId;
        this.isMobileDevice = this.adsRequest.isMobileDevice;
        this.uploadKeyType = this.adsRequest.uploadKeyType;
        this.completedFormParams = this.adsRequest.formParams;
        this.isCreate = this.adsRequest.isCreate;
        this.loginCid = this.adsRequest.loginCid;
        this.targetCid = this.adsRequest.targetCid;
        this.targetUserListRN = this.adsRequest.targetUserListRN;
    }
    makeForm() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            // 0) Fetch objects for fields that have been filled in already
            yield Promise.all([
                this.maybeSetLoginCustomer(),
                this.maybeSetTargetCustomer(),
            ]);
            // 1a) User must first pick a login account from the dropdown, which will be the only field to show at first
            form.fields.push(yield this.loginCidField());
            if (!this.loginCustomer) {
                return form;
            }
            // 1b) If the chosen login account is a Manager, give the option to pick one of its client accounts as the target.
            if (this.loginCustomer.manager) {
                form.fields.push(yield this.targetCidField());
                if (!this.targetCustomer) {
                    return form;
                }
                // If not a manager account, set the targetCustomer to be the same as the loginCustomer
            }
            else {
                this.targetCustomer = this.loginCustomer;
            }
            // 2a) Now choose whether to create a new list or append to an existing one
            form.fields.push(this.createOrAppendField());
            if (!this.createOrAppend) {
                return form;
            }
            // 2b) Now choose whether to use mobile device ID data
            form.fields.push(this.mobileDeviceField());
            if (!this.mobileDevice) {
                return form;
            }
            // 2c) If mobile device data, add mobile app id field to form
            if (this.isMobileDevice) {
                form.fields.push(this.mobileAppIdField());
            }
            // 3) Branch 1: Show the fields for creating a new list (name & desc), plus hashing, and we're done
            if (this.isCreate) {
                form.fields.push(this.newListNameField());
                form.fields.push(this.newListDescriptionField());
                form.fields.push(this.doHashingFormField());
                return form;
            }
            // 4) Branch 2: Select an existing list, but we need to check that there is at least one to choose...
            const userListOptions = yield this.getUserListOptions();
            if (userListOptions.length) {
                form.fields.push(this.targetListField(userListOptions));
                form.fields.push(this.doHashingFormField());
            }
            else {
                form.fields.push(this.noAvailableListsField());
            }
            return form;
        });
    }
    loginCidField() {
        return __awaiter(this, void 0, void 0, function* () {
            let selectOptions;
            let description;
            if (this.loginCustomer) {
                selectOptions = [
                    this.selectOptionForCustomer(this.loginCustomer),
                ];
                description = "To reset this selection, please close and re-open the form.";
            }
            else {
                selectOptions = yield this.getLoginCidOptions();
                description = "This is like picking an account to work from using the menu in the Google Ads UI."
                    + " If you use a manager account to manage clients, choose the relevant manager account here."
                    + " If you login directly to an Ads account then choose it here.";
            }
            return {
                name: "loginCid",
                label: "Step 1) Choose login account",
                description,
                type: "select",
                options: selectOptions,
                default: this.loginCid,
                interactive: true,
                required: true,
            };
        });
    }
    targetCidField() {
        return __awaiter(this, void 0, void 0, function* () {
            let selectOptions;
            let description;
            if (this.targetCustomer) {
                selectOptions = [
                    this.selectOptionForCustomer(this.targetCustomer),
                    { name: "", label: "Reset..." },
                ];
                description = "Select \"Reset\" to go back.";
            }
            else {
                selectOptions = yield this.getTargetCidOptions();
                description = "This is the account where you want to send data, i.e. where the audience lists are defined.";
            }
            return {
                name: "targetCid",
                label: "Step 1b) Choose target account",
                description,
                type: "select",
                options: selectOptions,
                default: this.targetCid,
                interactive: true,
                required: true,
            };
        });
    }
    createOrAppendField() {
        return {
            name: "createOrAppend",
            label: "Step 2a) Create a new list or append to existing?",
            description: "Choose whether to create a new list or append to an existing one."
                + " You will then be shown the appropriate fields in the next step.",
            type: "select",
            options: [
                { name: CREATE_LIST_OPTION_NAME, label: "Create new list" },
                { name: "append", label: "Append to existing" },
            ],
            default: this.createOrAppend,
            interactive: true,
            required: true,
        };
    }
    mobileDeviceField() {
        return {
            name: "mobileDevice",
            label: "Step 2b) Are you sending Mobile Device ID data?",
            description: "Select this option to use mobile device IDs."
                + " You can perform customer matching using IDFA (Identifier for Advertising)"
                + " or AAID (Google Advertising ID) mobile device IDs."
                + " Note that mobile device IDs cannot be combined with any other types of customer data.",
            type: "select",
            options: [
                { name: "yes", label: "Yes" },
                { name: "no", label: "No" },
            ],
            default: this.mobileDevice,
            interactive: true,
            required: true,
        };
    }
    mobileAppIdField() {
        return {
            name: "mobileAppId",
            label: "Step 2c) Enter the mobile application ID",
            description: "A string that uniquely identifies a mobile application from which the data was collected to the Google Ads API."
                + " For iOS, the ID string is the 9 digit string that appears at the end of an App Store URL"
                + " (e.g., http://itunes.apple.com/us/app/APP_NAME/idMOBILE_APP_ID)."
                + " For Android, the ID string is the application's package name"
                + " (e.g., https://play.google.com/store/apps/details?id=MOBILE_APP_ID)",
            type: "string",
            default: "",
            required: true,
        };
    }
    newListNameField() {
        return {
            name: "newListName",
            label: "Step 3a) New list name",
            type: "string",
            description: "Name of the new user list",
            default: "",
            required: true,
        };
    }
    newListDescriptionField() {
        return {
            name: "newListDescription",
            label: "Step 3b) New list description",
            type: "string",
            description: "Description of the new user list",
            default: "",
            required: false,
        };
    }
    targetListField(selectOptions) {
        return {
            name: "targetUserListRN",
            label: "Step 3) Choose list to update",
            description: "Showing CRM-based lists that are open for updating.",
            type: "select",
            options: selectOptions,
            default: this.targetUserListRN,
            interactive: false,
            required: true,
        };
    }
    noAvailableListsField() {
        return {
            name: "noAvalaibleLists",
            label: "Error: No lists available for update",
            type: "textarea",
            description: "Expand the textarea field to see full message.",
            default: "Couldn't find any CRM-based user lists that are open for new memberships."
                + " If you are looking for a specific list, please check that it is shared with you and open for updates."
                + " You can also create a new list instead.",
            required: false,
        };
    }
    doHashingFormField() {
        return {
            name: "doHashing",
            label: "Step 4) Should the data be hashed first?",
            type: "select",
            description: "All personal data must be normalized and hashed before uploading to Google Ads."
                + " If your data is not yet hashed, select 'yes' and Looker will attempt to hash the data"
                + " according to Google Ads' requirements."
                + " If 'no' then the data will be sent as-is. This means the report data should already be normalized and"
                + " hashed inside your database."
                + " Note that if the data is not hashed correctly, your customer list will not match any audiences.",
            options: [
                { name: "yes", label: "Yes" },
                { name: "no", label: "No" },
            ],
            default: "yes",
            required: true,
        };
    }
    maybeSetLoginCustomer() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.loginCid) {
                return;
            }
            this.loginCustomer = yield this.getCustomer(this.loginCid);
        });
    }
    maybeSetTargetCustomer() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.targetCid) {
                return;
            }
            this.targetCustomer = yield this.getCustomer(this.targetCid);
        });
    }
    getLoginCidOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const listCustomersResp = yield this.apiClient.listAccessibleCustomers();
            const customerResourceNames = listCustomersResp.resourceNames;
            const customers = yield Promise.all(customerResourceNames.map((rn) => __awaiter(this, void 0, void 0, function* () {
                const clientCid = rn.replace("customers/", "");
                return this.getCustomer(clientCid).catch(() => undefined); // ignore any auth errors from draft accounts
            })));
            const filteredCustomers = customers.filter(Boolean);
            const sortedCustomers = filteredCustomers.sort(this.sortCustomersCompareFn);
            const selectOptions = sortedCustomers.map(this.selectOptionForCustomer);
            return selectOptions;
        });
    }
    getCustomer(cId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.apiClient.searchClientCustomers(cId)
                .then((data) => {
                const cust = data[0].results.filter((c) => c.customerClient.id === cId)[0].customerClient;
                if (!cust.descriptiveName) {
                    cust.descriptiveName = "Untitled";
                }
                return cust;
            });
        });
    }
    getTargetCidOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.loginCustomer) {
                throw new Error("Could not reference the login customer record.");
            }
            const searchResp = yield this.apiClient.searchClientCustomers(this.loginCustomer.id);
            const searchResults = searchResp.length ? searchResp[0].results : [];
            const clients = searchResults.map((result) => {
                const client = result.customerClient;
                if (!client.descriptiveName) {
                    client.descriptiveName = "Untitled";
                }
                return client;
            });
            const sortedClients = clients.sort(this.sortCustomersCompareFn);
            const selectOptions = sortedClients.map(this.selectOptionForCustomer);
            return selectOptions;
        });
    }
    selectOptionForCustomer(customer) {
        const name = customer.id;
        const title = customer.descriptiveName ? customer.descriptiveName : "Untitled";
        const prefix = customer.manager ? "[Manager] " : "";
        const suffix = `(${customer.id})`;
        const label = `${prefix}${title} ${suffix}`;
        return { name, label };
    }
    sortCustomersCompareFn(a, b) {
        if (a.manager && !b.manager) {
            return -1;
        }
        if (!a.manager && b.manager) {
            return 1;
        }
        if (a.descriptiveName < b.descriptiveName) {
            return -1;
        }
        return 0;
    }
    getUserListOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.targetCustomer) {
                throw new Error("Could not reference the target customer record.");
            }
            const searchResp = yield this.apiClient.searchOpenUserLists(this.targetCustomer.id, this.uploadKeyType);
            const userListResults = searchResp.length ? searchResp[0].results : [];
            const selectOptions = userListResults.map((i) => ({
                name: i.userList.resourceName,
                label: i.userList.name,
            }));
            return selectOptions;
        });
    }
}
exports.GoogleAdsActionFormBuilder = GoogleAdsActionFormBuilder;
