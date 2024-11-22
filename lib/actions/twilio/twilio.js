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
exports.TwilioAction = void 0;
const Hub = require("../../hub");
const twilio = require("twilio");
const MAX_LINES = 10;
const TWILIO_MAX_MESSAGE_BODY = 1600;
class TwilioAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "twilio";
        this.label = "Twilio - Send Data";
        this.iconName = "twilio/twilio.svg";
        this.description = "Send data from a Look to a phone number via Twilio.";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.Csv];
        this.requiredFields = [];
        this.params = [
            {
                name: "accountSid",
                label: "Account SID",
                required: true,
                sensitive: false,
                description: "Account SID from www.twilio.com/console.",
            }, {
                name: "authToken",
                label: "Auth Token",
                required: true,
                sensitive: true,
                description: "Auth Token from www.twilio.com/console.",
            }, {
                name: "from",
                label: "Twilio Verified Phone Number",
                required: true,
                sensitive: false,
                description: "A valid Twilio number from www.twilio.com/console/phone-numbers/verified.",
            },
        ];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!request.attachment || !request.attachment.dataBuffer) {
                throw "Couldn't get data from attachment.";
            }
            if (!request.formParams.to) {
                throw "Need a destination phone number.";
            }
            const body = request.suggestedTruncatedMessage(MAX_LINES, TWILIO_MAX_MESSAGE_BODY);
            const client = this.twilioClientFromRequest(request);
            const message = {
                from: request.params.from,
                to: request.formParams.to,
                body,
            };
            let response;
            try {
                yield client.messages.create(message);
            }
            catch (e) {
                response = { success: false, message: e.message };
            }
            return new Hub.ActionResponse(response);
        });
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    label: "Destination Phone Number",
                    name: "to",
                    required: true,
                    type: "string",
                }];
            return form;
        });
    }
    twilioClientFromRequest(request) {
        return twilio(request.params.accountSid, request.params.authToken);
    }
}
exports.TwilioAction = TwilioAction;
Hub.addAction(new TwilioAction());
