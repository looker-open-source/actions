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
    form(request) {
        const _super = Object.create(null, {
            form: { get: () => super.form }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const form = yield _super.form.call(this, request);
            form.fields.filter((field) => field.name === "bucket")[0].label = "Space Name";
            return form;
        });
    }
    amazonS3ClientFromRequest(request) {
        return new S3({
            region: request.params.region,
            endpoint: `https://${request.params.region}.digitaloceanspaces.com`,
            accessKeyId: request.params.access_key_id,
            secretAccessKey: request.params.secret_access_key,
        });
    }
}
exports.DigitalOceanObjectStorageAction = DigitalOceanObjectStorageAction;
Hub.addAction(new DigitalOceanObjectStorageAction());
