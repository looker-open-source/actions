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
            let data = {};
            if (request.formParams.data) {
                data = request.formParams.data;
                if (!data.alertId) {
                    throw "Need Valid AlertId.";
                }
            }
            else {
                throw "Need valid notification data.";
            }
            yield this.verifyAndSendMessage(request.formParams);
            return new Hub.ActionResponse(response);
        });
    }
    verifyAndSendMessage(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const data = params.data;
                if (!params.title) {
                    reject("Needs a valid title.");
                }
                if (!params.deviceIds) {
                    resolve();
                }
                const notification = { title: params.title };
                const notificationData = data;
                const notificationOptions = this.notificationOptions;
                notificationData.id = uuid_1.v4();
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
                        resolve();
                    }
                    for (const userDevices of userObj) {
                        const devices = userDevices;
                        for (const device of devices) {
                            if (device.device_id && device.user_id) {
                                const deviceId = device.device_id.toString();
                                notificationData.userId = device.user_id.toString();
                                const payload = {
                                    notification,
                                    data: notificationData,
                                };
                                try {
                                    yield this.sendMessageToDevice(deviceId, payload, notificationOptions);
                                }
                                catch (error) {
                                    reject(error);
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    reject(error);
                }
                resolve();
            }))
                .catch((error) => {
                throw error;
            });
        });
    }
    sendMessageToDevice(deviceId, payload, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                FirebaseAction.setFirebaseClient();
                firebaseAdmin.messaging().sendToDevice(deviceId, payload, options)
                    .then((_) => {
                    resolve();
                })
                    .catch((error) => {
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
}
else {
    winston.warn(`${LOG_PREFIX} Action not registered because required environment variables are missing.`);
}
