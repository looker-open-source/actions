"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const integrations = [];
function addIntegration(integration) {
    integrations.push(integration);
}
exports.addIntegration = addIntegration;
function allIntegrations() {
    return __awaiter(this, void 0, void 0, function* () {
        const whitelistNames = process.env.INTEGRATION_WHITELIST;
        if (typeof whitelistNames === "string" && whitelistNames.length > 0) {
            const whitelist = whitelistNames.split(",");
            return integrations.filter((i) => whitelist.indexOf(i.name) !== -1);
        }
        else {
            return integrations;
        }
    });
}
exports.allIntegrations = allIntegrations;
function findDestination(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const all = yield allIntegrations();
        const integration = all.filter((i) => i.name === id)[0];
        if (!integration) {
            throw "No integration found.";
        }
        return integration;
    });
}
exports.findDestination = findDestination;
