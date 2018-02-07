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
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const express = require("express");
const fs = require("fs");
const path = require("path");
const Raven = require("raven");
const winston = require("winston");
const Hub = require("../hub");
const apiKey = require("./api_key");
const expressWinston = require("express-winston");
const TOKEN_REGEX = new RegExp(/[T|t]oken token="(.*)"/);
const statusJsonPath = path.resolve(`${__dirname}/../../status.json`);
const useRaven = () => !!process.env.ACTION_HUB_RAVEN_DSN;
class Server {
    static run() {
        dotenv.config();
        if (useRaven()) {
            let statusJson = {};
            if (fs.existsSync(statusJsonPath)) {
                statusJson = JSON.parse(fs.readFileSync(statusJsonPath).toString());
            }
            Raven.config(process.env.ACTION_HUB_RAVEN_DSN, {
                captureUnhandledRejections: true,
                release: statusJson.git_commit,
                autoBreadcrumbs: true,
                environment: process.env.ACTION_HUB_BASE_URL,
            }).install();
        }
        if (!process.env.ACTION_HUB_BASE_URL) {
            throw new Error("No ACTION_HUB_BASE_URL environment variable set.");
        }
        if (!process.env.ACTION_HUB_LABEL) {
            throw new Error("No ACTION_HUB_LABEL environment variable set.");
        }
        if (!process.env.ACTION_HUB_SECRET) {
            throw new Error("No ACTION_HUB_SECRET environment variable set.");
        }
        if (process.env.ACTION_HUB_DEBUG) {
            winston.configure({
                level: "debug",
                transports: [
                    new (winston.transports.Console)(),
                ],
            });
            winston.debug("Debug Mode");
        }
        Server.listen();
    }
    static listen(port = process.env.PORT || 8080) {
        const app = new Server().app;
        app.listen(port, () => {
            winston.info(`Action Hub listening!`, { port });
        });
    }
    constructor() {
        this.app = express();
        if (useRaven()) {
            this.app.use(Raven.requestHandler());
            this.app.use(Raven.errorHandler());
        }
        this.app.use(bodyParser.json({ limit: "250mb" }));
        this.app.use(expressWinston.logger({
            winstonInstance: winston,
            dynamicMeta: this.requestLog,
            requestFilter(req, propName) {
                if (propName !== "headers") {
                    return req[propName];
                }
            },
        }));
        this.app.use(express.static("public"));
        this.route("/", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const actions = yield Hub.allActions({ lookerVersion: request.lookerVersion });
            const response = {
                integrations: actions.map((d) => d.asJson(this)),
                label: process.env.ACTION_HUB_LABEL,
            };
            res.json(response);
            winston.debug(`response: ${JSON.stringify(response)}`);
        }));
        this.route("/actions/:actionId", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const action = yield Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion });
            res.json(action.asJson(this));
        }));
        this.route("/actions/:actionId/execute", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const action = yield Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion });
            if (action.hasExecute) {
                const actionResponse = yield action.validateAndExecute(request);
                res.json(actionResponse.asJson());
            }
            else {
                throw "No action defined for action.";
            }
        }));
        this.route("/actions/:actionId/form", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const action = yield Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion });
            if (action.hasForm) {
                const form = yield action.validateAndFetchForm(request);
                res.json(form.asJson());
            }
            else {
                throw "No form defined for action.";
            }
        }));
        // To provide a health or version check endpoint you should place a status.json file
        // into the project root, which will get served by this endpoint (or 404 otherwise).
        this.app.get("/status", (_req, res) => {
            res.sendFile(statusJsonPath);
        });
    }
    actionUrl(action) {
        return this.absUrl(`/actions/${encodeURIComponent(action.name)}/execute`);
    }
    formUrl(action) {
        return this.absUrl(`/actions/${encodeURIComponent(action.name)}/form`);
    }
    route(urlPath, fn) {
        this.app.post(urlPath, (req, res) => __awaiter(this, void 0, void 0, function* () {
            this.logInfo(req, res, "Starting request.");
            if (useRaven()) {
                const data = this.requestLog(req, res);
                Raven.setContext({
                    instanceId: data.instanceId,
                    webhookId: data.webhookId,
                });
            }
            const tokenMatch = (req.header("authorization") || "").match(TOKEN_REGEX);
            if (!tokenMatch || !apiKey.validate(tokenMatch[1])) {
                res.status(403);
                res.json({ success: false, error: "Invalid 'Authorization' header." });
                this.logInfo(req, res, "Unauthorized request.");
                return;
            }
            try {
                yield fn(req, res);
            }
            catch (e) {
                this.logError(req, res, "Error on request");
                if (typeof (e) === "string") {
                    res.status(404);
                    res.json({ success: false, error: e });
                    this.logError(req, res, e);
                }
                else {
                    res.status(500);
                    res.json({ success: false, error: "Internal server error." });
                    this.logError(req, res, e);
                    if (useRaven()) {
                        Raven.captureException(e);
                    }
                }
            }
            if (useRaven()) {
                Raven.setContext({});
            }
        }));
    }
    logInfo(req, res, message, options = {}) {
        winston.info(message, Object.assign({}, options, this.requestLog(req, res)));
    }
    logError(req, res, message, options = {}) {
        winston.error(message, Object.assign({}, options, this.requestLog(req, res)));
    }
    requestLog(req, res) {
        return {
            url: req.url,
            ip: req.ip,
            statusCode: res.statusCode,
            instanceId: req.header("x-looker-instance"),
            webhookId: req.header("x-looker-webhook-id"),
        };
    }
    absUrl(rootRelativeUrl) {
        return `${process.env.ACTION_HUB_BASE_URL}${rootRelativeUrl}`;
    }
}
exports.default = Server;
