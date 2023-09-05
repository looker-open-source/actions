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
exports.FirebaseAction = void 0;
const firebaseAdmin = require("firebase-admin");
const uuid_1 = require("uuid");
const winston = require("winston");
const Hub = require("../../hub");
const LOG_PREFIX = "[Firebase]";
class FirebaseAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "firebase";
        this.label = "Firebase";
        this.iconName = "firebase/firebase.png";
        this.description = "Use firebase to send push notifications to mobile.";
        this.minimumSupportedLookerVersion = "22.3.0";
        this.contentType = "image/jpeg";
        this.notificationOptions = {
            priority: "high",
            timeToLive: 60 * 60 * 24,
            contentAvailable: true,
            mutableContent: true,
        };
        this.params = [];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.JsonDetail];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
    }
    static setFirebaseClient() {
        var _a;
        if (firebaseAdmin.apps.length === 0) {
            FirebaseAction.firebaseAdmin = firebaseAdmin.initializeApp({
                credential: firebaseAdmin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: (_a = process.env.FIREBASE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, "\n"),
                }),
                databaseURL: process.env.FIREBASE_DATABASE,
            });
        }
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = new Hub.ActionResponse({ success: true });
            const webhookId = request.webhookId;
            winston.info(`${LOG_PREFIX} Firebase action (v 16.06.2022) called.`, { webhookId });
            let data = {};
            if (request.formParams.data) {
                data = request.formParams.data;
                if (!data.alert_id) {
                    winston.warn(`${LOG_PREFIX} Need Valid AlertId.`, { webhookId });
                    throw "Need Valid AlertId.";
                }
            }
            else {
                winston.warn(`${LOG_PREFIX} Need valid notification data.`, { webhookId });
                throw "Need valid notification data.";
            }
            yield this.verifyAndSendMessage(request.formParams, webhookId);
            return new Hub.ActionResponse(response);
        });
    }
    verifyAndSendMessage(params, webhookId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const data = params.data;
                if (!params.title) {
                    winston.warn(`${LOG_PREFIX} Needs a valid title.`, { webhookId });
                    reject("Needs a valid title.");
                }
                if (!params.deviceIds) {
                    winston.warn(`${LOG_PREFIX} Device Ids not present.`, { webhookId });
                    resolve();
                }
                const notification = {
                    title: params.title,
                    body: `On ${data.dashboard_name}`,
                };
                const notificationData = data;
                const notificationOptions = this.notificationOptions;
                notificationData.id = (0, uuid_1.v4)();
                if (params.timeToLive) {
                    notificationOptions.timeToLive = parseFloat(params.timeToLive);
                }
                if (params.priority) {
                    notificationOptions.priority = params.priority;
                }
                try {
                    const userObj = JSON.parse((_a = params.deviceIds) !== null && _a !== void 0 ? _a : "[]");
                    const deviceIdObject = params.deviceIds;
                    if (deviceIdObject.length === 0) {
                        winston.warn(`${LOG_PREFIX} Device Id length is 0.`, { webhookId });
                        resolve();
                    }
                    for (const userDevices of userObj) {
                        const devices = userDevices;
                        for (const device of devices) {
                            if (device.device_id && device.user_id) {
                                const deviceId = device.device_id.toString();
                                notificationData.user_id = device.user_id.toString();
                                const payload = {
                                    notification,
                                    data: notificationData,
                                };
                                try {
                                    yield this.sendMessageToDevice(deviceId, webhookId, payload, notificationOptions);
                                }
                                catch (error) {
                                    winston.error(`${LOG_PREFIX} Error in sendMessageToDevice. ${error.toString()} `, { webhookId });
                                    reject(error);
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    winston.error(`${LOG_PREFIX} Error. ${error.toString()} `, { webhookId });
                    reject(error);
                }
                resolve();
            }))
                .catch((error) => {
                winston.error(`${LOG_PREFIX} Error. ${error.toString()} `, { webhookId });
                throw error;
            });
        });
    }
    sendMessageToDevice(deviceId, webhookId, payload, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                FirebaseAction.setFirebaseClient();
                firebaseAdmin.messaging().sendToDevice(deviceId, payload, options)
                    .then((response) => {
                    winston.info(`${LOG_PREFIX} notification sent to firebase. ${JSON.stringify(response)}`, { webhookId });
                    resolve();
                })
                    .catch((error) => {
                    winston.error(`${LOG_PREFIX} notification sending failed to firebase. ${error.toString()} `, { webhookId });
                    reject(error.message);
                });
            })
                .catch((error) => {
                throw error;
            });
        });
    }
}
exports.FirebaseAction = FirebaseAction;
if (process.env.FIREBASE_PROJECT_ID
    && process.env.FIREBASE_CLIENT_EMAIL
    && process.env.FIREBASE_PRIVATE_KEY
    && process.env.FIREBASE_DATABASE) {
    Hub.addAction(new FirebaseAction());
    winston.warn(`${LOG_PREFIX} Action registered.`);
}
else {
    winston.warn(`${LOG_PREFIX} Action not registered because required environment variables are missing.`);
}
