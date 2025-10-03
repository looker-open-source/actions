"use strict";
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
    async execute(request) {
        return new Promise(async (resolve, reject) => {
            if (!request.attachment || !request.attachment.dataBuffer) {
                reject("Couldn't get data from attachment.");
                return;
            }
            if (!request.formParams.address) {
                reject("Needs a valid SFTP address.");
                return;
            }
            const client = await this.sftpClientFromRequest(request);
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
        });
    }
    async form() {
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
    }
    async sftpClientFromRequest(request) {
        const client = new Client();
        const parsedUrl = new url_1.URL(request.formParams.address);
        if (!parsedUrl.hostname) {
            throw "Needs a valid SFTP address.";
        }
        try {
            await client.connect({
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
    }
}
exports.SFTPAction = SFTPAction;
const sftpAction = new SFTPAction();
Hub.addUnfilteredAction(sftpAction);
Hub.addAction(sftpAction);
