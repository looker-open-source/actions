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
exports.SFTPAction = void 0;
const Hub = require("../../hub");
const Path = require("path");
const Client = require("ssh2-sftp-client");
const url_1 = require("url");
class SFTPAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "sftp";
        this.label = "SFTP";
        this.iconName = "sftp/sftp.png";
        this.description = "Send data files to an SFTP server.";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.params = [];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                if (!request.attachment || !request.attachment.dataBuffer) {
                    reject("Couldn't get data from attachment.");
                    return;
                }
                if (!request.formParams.address) {
                    reject("Needs a valid SFTP address.");
                    return;
                }
                const client = yield this.sftpClientFromRequest(request);
                const parsedUrl = new url_1.URL(request.formParams.address);
                if (!parsedUrl.pathname) {
                    throw "Needs a valid SFTP address.";
                }
                const data = request.attachment.dataBuffer;
                const fileName = request.formParams.filename || request.suggestedFilename();
                const remotePath = Path.join(parsedUrl.pathname, fileName);
                client.put(data, remotePath)
                    .then(() => resolve(new Hub.ActionResponse()))
                    .catch((err) => resolve(new Hub.ActionResponse({ success: false, message: err.message })));
            }));
        });
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    name: "address",
                    label: "Address",
                    description: "e.g. sftp://host/path/",
                    type: "string",
                    required: true,
                }, {
                    name: "username",
                    label: "Username",
                    type: "string",
                    required: true,
                }, {
                    name: "password",
                    label: "Password",
                    type: "string",
                    required: true,
                }, {
                    label: "Filename",
                    name: "filename",
                    type: "string",
                }];
            return form;
        });
    }
    sftpClientFromRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = new Client();
            const parsedUrl = new url_1.URL(request.formParams.address);
            if (!parsedUrl.hostname) {
                throw "Needs a valid SFTP address.";
            }
            try {
                yield client.connect({
                    host: parsedUrl.hostname,
                    username: request.formParams.username,
                    password: request.formParams.password,
                    port: +(parsedUrl.port ? parsedUrl.port : 22),
                });
            }
            catch (e) {
                throw e;
            }
            return client;
        });
    }
}
exports.SFTPAction = SFTPAction;
