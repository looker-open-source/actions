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
const path = require("path");
const winston = require("winston");
const D = require("../framework");
const apiKey = require("./api_key");
const TOKEN_REGEX = new RegExp(/[T|t]oken token="(.*)"/);
class Server {
    static run() {
        dotenv.config();
        if (!process.env.BASE_URL) {
            throw new Error("No BASE_URL environment variable set.");
        }
        if (!process.env.INTEGRATION_PROVIDER_LABEL) {
            throw new Error("No INTEGRATION_PROVIDER_LABEL environment variable set.");
        }
        if (!process.env.INTEGRATION_SERVICE_SECRET) {
            throw new Error("No INTEGRATION_SERVICE_SECRET environment variable set.");
        }
        if (process.env.INTEGRATION_SERVICE_DEBUG) {
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
            winston.info(`Integration Server listening on port ${port}!`);
        });
    }
    constructor() {
        this.app = express();
        this.app.use(bodyParser.json({ limit: "250mb" }));
        this.app.use(express.static("public"));
        this.route("/", (_req, res) => __awaiter(this, void 0, void 0, function* () {
            const integrations = yield D.allIntegrations();
            const response = {
                integrations: integrations.map((d) => d.asJson(this)),
                label: process.env.INTEGRATION_PROVIDER_LABEL,
            };
            res.json(response);
            winston.debug(`response: ${JSON.stringify(response)}`);
        }));
        this.route("/integrations/:integrationId", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const destination = yield D.findDestination(req.params.integrationId);
            res.json(destination.asJson(this));
        }));
        this.route("/integrations/:integrationId/action", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const destination = yield D.findDestination(req.params.integrationId);
            if (destination.hasAction) {
                const actionResponse = yield destination.validateAndPerformAction(D.ActionRequest.fromRequest(req));
                res.json(actionResponse.asJson());
            }
            else {
                throw "No action defined for destination.";
            }
        }));
        this.route("/integrations/:integrationId/form", (req, res) => __awaiter(this, void 0, void 0, function* () {
            const destination = yield D.findDestination(req.params.integrationId);
            if (destination.hasForm) {
                const form = yield destination.validateAndFetchForm(D.ActionRequest.fromRequest(req));
                res.json(form.asJson());
            }
            else {
                throw "No form defined for destination.";
            }
        }));
        // To provide a health or version check endpoint you should place a status.json file
        // into the project root, which will get served by this endpoint (or 404 otherwise).
        this.app.get("/status", (_req, res) => {
            res.sendFile(path.resolve(`${__dirname}/../status.json`));
        });
    }
    actionUrl(integration) {
        return this.absUrl(`/integrations/${encodeURIComponent(integration.name)}/action`);
    }
    formUrl(integration) {
        return this.absUrl(`/integrations/${encodeURIComponent(integration.name)}/form`);
    }
    route(urlPath, fn) {
        this.app.post(urlPath, (req, res) => __awaiter(this, void 0, void 0, function* () {
            winston.info(`Starting request for ${req.url}`);
            const tokenMatch = (req.header("authorization") || "").match(TOKEN_REGEX);
            if (!tokenMatch || !apiKey.validate(tokenMatch[1])) {
                res.status(403);
                res.json({ success: false, error: "Invalid 'Authorization' header." });
                winston.info(`Unauthorized request for ${req.url}`);
                return;
            }
            try {
                yield fn(req, res);
                winston.info(`Completed request for ${req.url}`);
            }
            catch (e) {
                winston.error(`Error on request for ${req.url}:`);
                if (typeof (e) === "string") {
                    res.status(404);
                    res.json({ success: false, error: e });
                    winston.error(e);
                }
                else {
                    res.status(500);
                    res.json({ success: false, error: "Internal server error." });
                    winston.error(e);
                }
            }
        }));
    }
    absUrl(rootRelativeUrl) {
        return `${process.env.BASE_URL}${rootRelativeUrl}`;
    }
}
exports.default = Server;
