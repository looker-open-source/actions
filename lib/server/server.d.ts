import * as express from "express";
import * as Hub from "../hub";
export default class Server implements Hub.RouteBuilder {
    static run(): void;
    static listen(port: number, timeout: number): void;
    app: express.Application;
    private actionList;
    constructor();
    actionUrl(action: Hub.Action): string;
    formUrl(action: Hub.Action): string;
    private oauthRedirectUrl;
    /**
     * For JSON responses that take a long time without sending any data,
     * we periodically send a newline character to prevent the connection from being
     * dropped by proxies or other services (like the AWS NAT Gateway).
     */
    private jsonKeepAlive;
    private route;
    private logPromiseFail;
    private logInfo;
    private logError;
    private requestLog;
    private absUrl;
}
