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
const winston = require("winston");
const Hub = require("../../../hub");
class FacebookFormBuilder {
    generateActionForm(actionRequest, facebookApi) {
        return __awaiter(this, void 0, void 0, function* () {
            let adAccounts = [];
            let customAudiences = [];
            adAccounts = yield facebookApi.getAdAccounts();
            const form = new Hub.ActionForm();
            form.fields = [{
                    label: "Choose a Facebook ad account",
                    name: "choose_ad_account",
                    required: true,
                    interactive: true,
                    type: "select",
                    options: [
                        ...(yield this.generateOptionsFromNamesAndIds(adAccounts)),
                    ],
                }];
            if (actionRequest.formParams.choose_ad_account) {
                form.fields.push({
                    label: "Would you like to create a new audience, update existing, or replace existing?",
                    name: "choose_create_update_replace",
                    description: "Updating appends users. Replacing first deletes" +
                        "all users from the audience then appends users.",
                    required: true,
                    interactive: true,
                    type: "select",
                    options: [
                        { name: "create_audience", label: "Create new audience" },
                        { name: "update_audience", label: "Update existing audience" },
                        { name: "replace_audience", label: "Replace existing audience" },
                    ],
                    default: "create_audience",
                });
            }
            if (actionRequest.formParams.choose_ad_account && (actionRequest.formParams.choose_create_update_replace === "create_audience"
                || !actionRequest.formParams.choose_create_update_replace)) {
                form.fields.push({
                    label: "New audience name",
                    name: "create_audience_name",
                    required: true,
                    type: "string",
                });
                form.fields.push({
                    label: "New audience description",
                    name: "create_audience_description",
                    required: true,
                    type: "string",
                });
                form.fields.push({
                    label: "Should the data be hashed first?",
                    name: "should_hash",
                    description: "Yes is appropriate for most users." +
                        " Only select No if you know your data has already been hashed.",
                    required: true,
                    type: "select",
                    options: [
                        { name: "do_hashing", label: "Yes" },
                        { name: "do_no_hashing", label: "No" },
                    ],
                    default: "do_hashing",
                });
            }
            else if (actionRequest.formParams.choose_create_update_replace === "update_audience" ||
                actionRequest.formParams.choose_create_update_replace === "replace_audience") {
                if (!actionRequest.formParams.choose_ad_account) {
                    throw new Error("Cannot obtain audience list without an ad account selected");
                }
                customAudiences = yield facebookApi.getCustomAudiences(actionRequest.formParams.choose_ad_account);
                const audienceActionType = (actionRequest.formParams.choose_create_update_replace === "update_audience") ?
                    "update" : "replace";
                const customAudienceOptions = [...yield (this.generateOptionsFromNamesAndIds(customAudiences))];
                let audienceSelectDescription = audienceActionType === "replace" ?
                    "Replacing first deletes all users from the audience then appends users." : "";
                if (customAudienceOptions.length <= 0) {
                    audienceSelectDescription = "You have no custom audiences for this ad account." +
                        " You can create one by selecting \"Create new audience\" above.";
                }
                form.fields.push({
                    label: `Choose an audience to ${audienceActionType}`,
                    name: "choose_custom_audience",
                    description: audienceSelectDescription,
                    required: true,
                    type: "select",
                    options: [
                        ...customAudienceOptions,
                    ],
                });
                form.fields.push({
                    label: "Should the data be hashed first?",
                    name: "should_hash",
                    description: "Yes is appropriate for most users. Only select No if you know" +
                        " your data has already been hashed.",
                    required: true,
                    type: "select",
                    options: [
                        { name: "do_hashing", label: "Yes" },
                        { name: "do_no_hashing", label: "No" },
                    ],
                    default: "do_hashing",
                });
            }
            return form;
        });
    }
    generateOptionsFromNamesAndIds(list) {
        return __awaiter(this, void 0, void 0, function* () {
            return list.map((item) => ({
                name: item.id,
                label: item.name,
            }));
        });
    }
    generateLoginForm(actionRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            const payloadString = JSON.stringify({ stateUrl: actionRequest.params.state_url });
            //  Payload is encrypted to keep things private and prevent tampering
            let encryptedPayload;
            try {
                const actionCrypto = new Hub.ActionCrypto();
                encryptedPayload = yield actionCrypto.encrypt(payloadString);
            }
            catch (e) {
                winston.error("Payload encryption error:", e.toString());
                throw e;
            }
            // Step 1 in the oauth flow - user clicks the button in the form and visits the AH url generated here.
            // That response will be auto handled by the AH server as a redirect to the result of oauthUrl function below.
            const startAuthUrl = `${process.env.ACTION_HUB_BASE_URL}/actions/facebook_custom_audiences/oauth?state=${encryptedPayload}`;
            winston.debug("login form has startAuthUrl=", startAuthUrl);
            const form = new Hub.ActionForm();
            form.state = new Hub.ActionState();
            form.state.data = "reset";
            form.fields = [];
            form.fields.push({
                name: "login",
                type: "oauth_link",
                label: "Log in to Facebook",
                description: "In order to use Facebook Custom Audiences as a destination, you will need to log in" +
                    " once to your Facebook account.",
                oauth_url: startAuthUrl,
            });
            return form;
        });
    }
}
exports.default = FacebookFormBuilder;
