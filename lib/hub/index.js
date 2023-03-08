"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.allFields = exports.JsonDetail = exports.ActionCrypto = void 0;
__exportStar(require("./action_form"), exports);
__exportStar(require("./action_request"), exports);
__exportStar(require("./action_state"), exports);
__exportStar(require("./action_response"), exports);
__exportStar(require("./action"), exports);
__exportStar(require("./oauth_action"), exports);
__exportStar(require("./delegate_oauth_action"), exports);
__exportStar(require("./sources"), exports);
__exportStar(require("./utils"), exports);
const aes_transit_crypto_1 = require("../crypto/aes_transit_crypto");
Object.defineProperty(exports, "ActionCrypto", { enumerable: true, get: function () { return aes_transit_crypto_1.AESTransitCrypto; } });
const JsonDetail = require("./json_detail");
exports.JsonDetail = JsonDetail;
function allFields(fields) {
    let all = [];
    if (fields.dimensions) {
        all = all.concat(fields.dimensions);
    }
    if (fields.measures) {
        all = all.concat(fields.measures);
    }
    if (fields.filters) {
        all = all.concat(fields.filters);
    }
    if (fields.parameters) {
        all = all.concat(fields.parameters);
    }
    if (fields.table_calculations) {
        all = all.concat(fields.table_calculations);
    }
    return all;
}
exports.allFields = allFields;
