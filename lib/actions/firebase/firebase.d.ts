import * as firebaseAdmin from "firebase-admin";
import * as firebaseApp from "firebase-admin/app";
import * as Hub from "../../hub";
export declare class FirebaseAction extends Hub.Action {
    static firebaseAdmin: firebaseApp.App;
    static setFirebaseClient(): void;
    name: string;
    label: string;
    iconName: string;
    description: string;
    minimumSupportedLookerVersion: string;
    contentType: string;
    notificationOptions: {
        priority: string;
        timeToLive: number;
        contentAvailable: boolean;
        mutableContent: boolean;
    };
    params: never[];
    supportedActionTypes: Hub.ActionType[];
    supportedFormats: Hub.ActionFormat[];
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    verifyAndSendMessage(params: Hub.ParamMap, webhookId: string | undefined): Promise<any>;
    sendMessageToDevice(deviceId: string, webhookId: string | undefined, payload: firebaseAdmin.messaging.MessagingPayload, options?: firebaseAdmin.messaging.MessagingOptions): Promise<any>;
}
