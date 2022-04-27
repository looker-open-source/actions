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
exports.AmazonEC2Action = void 0;
const Hub = require("../../hub");
const EC2 = require("aws-sdk/clients/ec2");
const TAG = "aws_resource_id";
class AmazonEC2Action extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "aws_ec2_stop_instance";
        this.label = "AWS EC2 - Stop Instance";
        this.iconName = "amazon/amazon_ec2.png";
        this.description = "Stop an EC2 instance.";
        this.params = [
            {
                name: "access_key_id",
                label: "Access Key",
                required: true,
                sensitive: true,
                description: "Your access key for EC2.",
            }, {
                name: "secret_access_key",
                label: "Secret Key",
                required: true,
                sensitive: true,
                description: "Your secret key for EC2.",
            }, {
                name: "region",
                label: "Region",
                required: true,
                sensitive: false,
                description: "EC2 Region e.g. us-east-1, us-west-1, ap-south-1 from " +
                    "http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region.",
            },
        ];
        this.supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.JsonDetail];
        this.requiredFields = [{ tag: TAG }];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            let instanceIds = [];
            switch (request.type) {
                case Hub.ActionType.Query:
                    if (!(request.attachment && request.attachment.dataJSON)) {
                        throw "Couldn't get data from attachment.";
                    }
                    const qr = request.attachment.dataJSON;
                    if (!qr.fields || !qr.data) {
                        throw "Request payload is an invalid format.";
                    }
                    const fields = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]));
                    const identifiableFields = fields.filter((f) => f.tags && f.tags.some((t) => t === TAG));
                    if (identifiableFields.length === 0) {
                        throw `Query requires a field tagged ${TAG}.`;
                    }
                    instanceIds = qr.data.map((row) => (row[identifiableFields[0].name].value));
                    break;
                case Hub.ActionType.Cell:
                    if (!request.params.value) {
                        throw "Couldn't get data from cell.";
                    }
                    instanceIds = [request.params.value];
                    break;
            }
            const params = { InstanceIds: instanceIds };
            const ec2 = this.amazonEC2ClientFromRequest(request);
            let response;
            try {
                yield ec2.stopInstances(params).promise();
            }
            catch (e) {
                response = { success: false, message: e.message };
            }
            return new Hub.ActionResponse(response);
        });
    }
    amazonEC2ClientFromRequest(request) {
        return new EC2(({
            region: request.params.region,
            accessKeyId: request.params.access_key_id,
            secretAccessKey: request.params.secret_access_key,
        }));
    }
}
exports.AmazonEC2Action = AmazonEC2Action;
Hub.addAction(new AmazonEC2Action());
