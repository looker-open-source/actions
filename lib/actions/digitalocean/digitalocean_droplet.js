"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalOceanDropletAction = void 0;
const Hub = require("../../hub");
const digitalOcean = require("do-wrapper");
const TAG = "digitalocean_droplet_id";
class DigitalOceanDropletAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "digitalocean_droplet";
        this.label = "DigitalOcean - Stop Droplet";
        this.iconName = "digitalocean/DigitalOcean.png";
        this.description = "Stop a DigitalOcean droplet.";
        this.params = [
            {
                name: "digitalocean_api_key",
                label: "DigitalOcean API Key",
                required: true,
                sensitive: true,
                description: "",
            },
        ];
        this.supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.JsonDetail];
        this.requiredFields = [{ tag: TAG }];
    }
    async execute(request) {
        return new Promise((resolve, reject) => {
            let instanceIds = [];
            switch (request.type) {
                case Hub.ActionType.Query:
                    if (!(request.attachment && request.attachment.dataJSON)) {
                        reject("Couldn't get data from attachment.");
                        return;
                    }
                    const qr = request.attachment.dataJSON;
                    if (!qr.fields || !qr.data) {
                        reject("Request payload is an invalid format.");
                        return;
                    }
                    const fields = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]));
                    const identifiableFields = fields.filter((f) => f.tags && f.tags.some((t) => t === TAG));
                    if (identifiableFields.length === 0) {
                        reject(`Query requires a field tagged ${TAG}.`);
                        return;
                    }
                    instanceIds = qr.data.map((row) => (row[identifiableFields[0].name].value));
                    break;
                case Hub.ActionType.Cell:
                    const value = request.params.value;
                    if (!value) {
                        reject("Couldn't get data from attachment.");
                        return;
                    }
                    instanceIds = [value];
                    break;
            }
            const digitalOceanClient = this.digitalOceanClientFromRequest(request);
            instanceIds.forEach((dropletId) => {
                digitalOceanClient.dropletsRequestAction(+dropletId, { type: "power_off" }, (err) => {
                    if (err) {
                        resolve(new Hub.ActionResponse({ success: false, message: err.message }));
                    }
                    else {
                        resolve(new Hub.ActionResponse());
                    }
                });
            });
        });
    }
    digitalOceanClientFromRequest(request) {
        return new digitalOcean(request.params.digitalocean_api_key);
    }
}
exports.DigitalOceanDropletAction = DigitalOceanDropletAction;
Hub.addAction(new DigitalOceanDropletAction());
