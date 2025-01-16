"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actions = void 0;
exports.addAction = addAction;
exports.allActions = allActions;
exports.findAction = findAction;
exports.findExtendedAction = findExtendedAction;
const semver = require("semver");
exports.actions = [];
function addAction(action) {
    exports.actions.push(action);
}
async function allActions(opts) {
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
}
async function findAction(id, opts) {
    const all = await allActions(opts);
    const matching = all.filter((i) => i.name === id);
    if (matching.length === 0) {
        throw `No action found with name ${id}.`;
    }
    return matching[0];
}
async function findExtendedAction(id, opts) {
    const action = await findAction(id, opts);
    return action.extendedAction ? action : null;
}
