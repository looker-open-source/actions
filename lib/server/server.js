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
const express = require("express");
const fs = require("fs");
const path = require("path");
const Raven = require("raven");
const winston = require("winston");
const Hub = require("../hub");
const hub_1 = require("../hub");
const ExecuteProcessQueue = require("../xpc/execute_process_queue");
const ExtendedProcessQueue = require("../xpc/extended_process_queue");
const apiKey = require("./api_key");
const expressWinston = require("express-winston");
const uparse = require("url");
const blocked = require("blocked-at");
const TOKEN_REGEX = new RegExp(/[T|t]oken token="(.*)"/);
const statusJsonPath = path.resolve(`${__dirname}/../../status.json`);
const useRaven = () => !!process.env.ACTION_HUB_RAVEN_DSN;
// Should be used with actions that hold the event loop extensively
const expensiveJobQueue = new ExecuteProcessQueue.ExecuteProcessQueue();
// Should be used with actions that may exist for long periods of time
const extendedJobQueue = new ExtendedProcessQueue.ExtendedProcessQueue();
class Server {
    static run() {
        if (useRaven()) {
            let statusJson = {};
            if (fs.existsSync(statusJsonPath)) {
                statusJson = JSON.parse(fs.readFileSync(statusJsonPath).toString());
            }
            Raven.config(process.env.ACTION_HUB_RAVEN_DSN, {
                captureUnhandledRejections: true,
                release: statusJson.git_commit,
                autoBreadcrumbs: false,
                environment: process.env.ACTION_HUB_BASE_URL,
            }).install();
        }
        blocked((time, stack) => {
            winston.warn(`Event loop blocked for ${time}ms, operation started here:\n${stack.join("\n")}`);
        }, { threshold: 100 });
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
        const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
        // Default to 0 to prevent Node from applying timeout to sockets
        // Load balancers in front of the app may still timeout
        const timeout = process.env.ACTION_HUB_SOCKET_TIMEOUT ? parseInt(process.env.ACTION_HUB_SOCKET_TIMEOUT, 10) : 0;
        Server.listen(port, timeout);
    }
    static listen(port, timeout) {
        const app = new Server().app;
        const nodeServer = app.listen(port, () => {
            winston.info(`Action Hub listening!`, { port });
        });
        nodeServer.timeout = timeout;
    }
    constructor() {
        this.actionList = {};
        this.app = express();
        this.app.use(express.json({ limit: "250mb" }));
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
            const version = request.lookerVersion ? request.lookerVersion : "5.5.0";
            if (!this.actionList[version]) {
                const actions = yield Hub.allActions({ lookerVersion: request.lookerVersion });
                const response = {
                    integrations: actions.map((d) => d.asJson(this, request)),
                    label: process.env.ACTION_HUB_LABEL,
                };
                this.actionList[version] = JSON.stringify(response);
            }
            res.type("json");
            res.send(this.actionList[version]);
            winston.debug(`version: ${version}, response: ${this.actionList[version]}`);
        }));
        this.route("/actions/:actionId", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const action = yield Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion });
            res.json(action.asJson(this, request));
        }));
        this.route("/actions/:actionId/execute", this.jsonKeepAlive((req, complete) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const action = yield Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion });
            const queue = action.extendedAction ? extendedJobQueue : expensiveJobQueue;
            const actionResponse = yield action.validateAndExecute(request, queue);
            complete(actionResponse.asJson());
        })));
        this.route("/actions/:actionId/form", this.jsonKeepAlive((req, complete) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const action = yield Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion });
            let form;
            if ((0, hub_1.isDelegateOauthAction)(action) && request.params.test) {
                form = yield action.oauthCheck(request);
            }
            else if (action.hasForm) {
                form = yield action.validateAndFetchForm(request);
            }
            if (form) {
                complete(form.asJson());
            }
            else {
                throw "No form defined for action.";
            }
        })));
        // Initial OAuth flow request from Resource Owner
        this.app.get("/actions/:actionId/oauth", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const action = yield Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion });
            if ((0, hub_1.isOauthAction)(action)) {
                const parts = uparse.parse(req.url, true);
                const state = parts.query.state;
                const url = yield action.oauthUrl(this.oauthRedirectUrl(action), state);
                res.redirect(url);
            }
            else {
                throw "Action does not support OAuth.";
            }
        }));
        this.app.get("/actions/:actionId/oauth_check", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const action = yield Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion });
            if ((0, hub_1.isOauthAction)(action)) {
                const check = action.oauthCheck(request);
                res.json(check);
            }
            else {
                res.statusCode = 404;
            }
        }));
        // Response from Authorization Server with response from OAuth flow
        this.app.get("/actions/:actionId/oauth_redirect", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const request = Hub.ActionRequest.fromRequest(req);
            const action = yield Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion });
            if ((0, hub_1.isOauthAction)(action)) {
                try {
                    yield action.oauthFetchInfo(req.query, this.oauthRedirectUrl(action));
                    res.statusCode = 200;
                    res.send(`<html><script>window.close()</script>><body>You may now close this tab.</body></html>`);
                }
                catch (e) {
                    this.logPromiseFail(req, res, e);
                    res.statusCode = 400;
                }
            }
            else {
                throw "Action does not support OAuth.";
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
    oauthRedirectUrl(action) {
        return this.absUrl(`/actions/${encodeURIComponent(action.name)}/oauth_redirect`);
    }
    /**
     * For JSON responses that take a long time without sending any data,
     * we periodically send a newline character to prevent the connection from being
     * dropped by proxies or other services (like the AWS NAT Gateway).
     */
    jsonKeepAlive(fn) {
        const interval = process.env.ACTION_HUB_JSON_KEEPALIVE_SEC ?
            parseInt(process.env.ACTION_HUB_JSON_KEEPALIVE_SEC, 10)
            :
                30;
        return (req, res) => __awaiter(this, void 0, void 0, function* () {
            res.status(200);
            res.setHeader("Content-Type", "application/json");
            const timer = setInterval(() => {
                res.write("\n");
            }, interval * 1000);
            try {
                yield fn(req, (data) => {
                    res.write(JSON.stringify(data));
                    res.end();
                });
            }
            finally {
                clearInterval(timer);
            }
        });
    }
    route(urlPath, fn) {
        this.app.post(urlPath, (req, res) => __awaiter(this, void 0, void 0, function* () {
            this.logInfo(req, res, "Starting request.");
            let ravenTags = {};
            if (useRaven()) {
                ravenTags = this.requestLog(req, res);
            }
            const headerValue = req.header("authorization");
            const tokenMatch = headerValue ? headerValue.match(TOKEN_REGEX) : undefined;
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
                    if (!res.headersSent) {
                        res.status(404);
                        res.json({ success: false, error: e });
                    }
                    this.logError(req, res, e);
                }
                else {
                    if (!res.headersSent) {
                        res.status(500);
                        res.json({ success: false, error: "Internal server error." });
                    }
                    this.logError(req, res, e);
                    if (useRaven()) {
                        Raven.captureException(e, { tags: ravenTags });
                    }
                }
            }
        }));
    }
    logPromiseFail(req, res, e) {
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
        }
    }
    logInfo(req, res, message, options = {}) {
        winston.info(message, Object.assign(Object.assign({}, options), this.requestLog(req, res)));
    }
    logError(req, res, message, options = {}) {
        winston.error(message, Object.assign(Object.assign({}, options), this.requestLog(req, res)));
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
