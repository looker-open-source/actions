"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalOceanObjectStorageAction = void 0;
const Hub = require("../../hub");
const amazon_s3_1 = require("../amazon/amazon_s3");
const S3 = require("aws-sdk/clients/s3");
class DigitalOceanObjectStorageAction extends amazon_s3_1.AmazonS3Action {
    constructor() {
        super(...arguments);
        this.name = "digitalocean_object_storage";
        this.label = "DigitalOcean Spaces";
        this.iconName = "digitalocean/DigitalOcean.png";
        this.description = "Write data files to DigitalOcean's Spaces storage.";
        this.params = [
            {
                name: "access_key_id",
                label: "Spaces Access Key",
                required: true,
                sensitive: false,
                description: "Your access key for DigitalOcean Spaces https://cloud.digitalocean.com/settings/api/tokens.",
            }, {
                name: "secret_access_key",
                label: "Spaces Secret Key",
                required: true,
                sensitive: true,
                description: "Your secret key for DigitalOcean Spaces https://cloud.digitalocean.com/settings/api/tokens.",
            }, {
                name: "region",
                label: "Region",
                required: true,
                sensitive: false,
                description: "DigitalOcean Region e.g. NYC3 ",
            },
        ];
    }
    async form(request) {
        const form = await super.form(request);
        form.fields.filter((field) => field.name === "bucket")[0].label = "Space Name";
        return form;
    }
    amazonS3ClientFromRequest(request) {
        const region = request.params.region;
        // The region is interpolated into the Spaces endpoint host, so it is
        // restricted to the DigitalOcean region charset to prevent host injection.
        if (!region || !/^[A-Za-z0-9-]+$/.test(region)) {
            throw "Invalid DigitalOcean region.";
        }
        return new S3({
            region,
            endpoint: `https://${region}.digitaloceanspaces.com`,
            accessKeyId: request.params.access_key_id,
            secretAccessKey: request.params.secret_access_key,
        });
    }
}
exports.DigitalOceanObjectStorageAction = DigitalOceanObjectStorageAction;
Hub.addAction(new DigitalOceanObjectStorageAction());
