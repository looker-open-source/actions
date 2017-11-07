/// <reference types="express" />
import * as express from "express";
import * as D from "../framework";
export default class Server implements D.IRouteBuilder {
    static run(): void;
    static listen(port?: string | number): void;
    app: express.Application;
    constructor();
    actionUrl(integration: D.Integration): string;
    formUrl(integration: D.Integration): string;
    private route(urlPath, fn);
    private absUrl(rootRelativeUrl);
}
