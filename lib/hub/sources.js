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
exports.findExtendedAction = exports.findAction = exports.allActions = exports.addAction = exports.actions = void 0;
const semver = require("semver");
exports.actions = [];
function addAction(action) {
    exports.actions.push(action);
}
exports.addAction = addAction;
function allActions(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const whitelistNames = process.env.ACTION_WHITELIST;
        let filtered;
        if (typeof whitelistNames === "string" && whitelistNames.length > 0) {
            const whitelist = whitelistNames.split(",");
            filtered = exports.actions.filter((i) => whitelist.indexOf(i.name) !== -1);
        }
        else {
            filtered = exports.actions;
        }
        if (opts && opts.lookerVersion) {
            filtered = filtered.filter((a) => semver.gte(opts.lookerVersion, a.minimumSupportedLookerVersion));
        }
        return filtered;
    });
}
exports.allActions = allActions;
function findAction(id, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const all = yield allActions(opts);
        const matching = all.filter((i) => i.name === id);
        if (matching.length === 0) {
            throw `No action found with name ${id}.`;
        }
        return matching[0];
    });
}
exports.findAction = findAction;
function findExtendedAction(id, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const action = yield findAction(id, opts);
        return action.extendedAction ? action : null;
    });
}
exports.findExtendedAction = findExtendedAction;
