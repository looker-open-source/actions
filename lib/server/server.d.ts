/// <reference types="express" />
import * as express from "express";
import * as Hub from "../hub";
export default class Server implements Hub.RouteBuilder {
    static run(): void;
    static listen(port?: string | number): void;
    app: express.Application;
    constructor();
    actionUrl(action: Hub.Action): string;
    formUrl(action: Hub.Action): string;
    private route(urlPath, fn);
    private logInfo(req, res, message, options?);
    private logError(req, res, message, options?);
    private requestLog(req, res);
    private absUrl(rootRelativeUrl);
}
