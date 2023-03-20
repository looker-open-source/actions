import * as firebaseAdmin from "firebase-admin"
import * as firebaseApp from "firebase-admin/app"
import { v4 } from "uuid"
import * as winston from "winston"
import * as Hub from "../../hub"

const LOG_PREFIX = "[Firebase]"

export class FirebaseAction extends Hub.Action {
  static firebaseAdmin: firebaseApp.App

  static setFirebaseClient() {
    if (firebaseAdmin.apps.length === 0) {
      FirebaseAction.firebaseAdmin = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        databaseURL: process.env.FIREBASE_DATABASE,
      })
    }
  }

  name = "firebase"
  label = "Firebase"
  iconName = "firebase/firebase.png"
  description = "Use firebase to send push notifications to mobile."
  minimumSupportedLookerVersion = "22.3.0"
  contentType = "image/jpeg"
  notificationOptions = {
    priority: "high",
    timeToLive: 60 * 60 * 24,
    contentAvailable: true,
    mutableContent: true,
  }
  params = []
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  async execute(request: Hub.ActionRequest) {
    const response = new Hub.ActionResponse({success: true})
    const webhookId = request.webhookId
    winston.info(`${LOG_PREFIX} Firebase action (v 16.06.2022) called.`, { webhookId })
    let data: any = {}
    if (request.formParams.data) {
      data = request.formParams.data
      if (!data.alert_id) {
        winston.warn(`${LOG_PREFIX} Need Valid AlertId.`, { webhookId })
        throw "Need Valid AlertId."
      }
    } else {
      winston.warn(`${LOG_PREFIX} Need valid notification data.`, { webhookId })
      throw "Need valid notification data."
    }
    await this.verifyAndSendMessage(request.formParams, webhookId)
    return new Hub.ActionResponse(response)
  }

  async verifyAndSendMessage(params: Hub.ParamMap, webhookId: string | undefined): Promise<any> {
    return new Promise<void>(async (resolve, reject) => {
      const data: any = params.data
      if (!params.title) {
        winston.warn(`${LOG_PREFIX} Needs a valid title.`, { webhookId })
        reject("Needs a valid title.")
      }
      if (!params.deviceIds) {
        winston.warn(`${LOG_PREFIX} Device Ids not present.`, { webhookId })
        resolve()
      }
      const notification: any = {
        title: params.title,
        body : `On ${data.dashboard_name}`,
      }
      const notificationData: any = data
      const notificationOptions = this.notificationOptions
      notificationData.id = v4()
      if (params.timeToLive) {
        notificationOptions.timeToLive = parseFloat(params.timeToLive)
      }
      if (params.priority) {
        notificationOptions.priority = params.priority
      }
      try {
        const userObj = JSON.parse(params.deviceIds ?? "[]") as any[]
        const deviceIdObject = params.deviceIds as unknown as any[]
        if (deviceIdObject.length === 0) {
          winston.warn(`${LOG_PREFIX} Device Id length is 0.`, { webhookId })
          resolve()
        }
        for (const userDevices of userObj) {
          const devices = userDevices as any[]
          for (const device of devices) {
            if (device.device_id && device.user_id) {
              const deviceId = device.device_id.toString()
              notificationData.user_id = device.user_id.toString()
              const payload = {
                notification,
                data: notificationData,
              }
              try {
                await this.sendMessageToDevice(deviceId, webhookId, payload, notificationOptions)
              } catch (error: any) {
                winston.error(`${LOG_PREFIX} Error in sendMessageToDevice. ${error.toString()} `, { webhookId })
                reject(error)
              }
            }
          }
        }
      } catch (error: any) {
        winston.error(`${LOG_PREFIX} Error. ${error.toString()} `, { webhookId })
        reject(error)
      }
      resolve()
    })
    .catch((error: any) => {
      winston.error(`${LOG_PREFIX} Error. ${error.toString()} `, { webhookId })
      throw error
    })
  }

  async sendMessageToDevice(deviceId: string,
                            webhookId: string | undefined,
                            payload: firebaseAdmin.messaging.MessagingPayload,
                            options?: firebaseAdmin.messaging.MessagingOptions,
                            ): Promise<any> {
    return new Promise<void>((resolve, reject) => {
      FirebaseAction.setFirebaseClient()
      firebaseAdmin.messaging().sendToDevice(deviceId, payload, options)
        .then( (response: any) => {
          winston.info(`${LOG_PREFIX} notification sent to firebase. ${JSON.stringify(response)}`, { webhookId })
          resolve()
        })
        .catch( (error: any) => {
          winston.error(`${LOG_PREFIX} notification sending failed to firebase. ${error.toString()} `, { webhookId })
          reject(error.message)
        })
    })
    .catch((error) => {
      throw error
    })
  }
}

if (process.env.FIREBASE_PROJECT_ID
  && process.env.FIREBASE_CLIENT_EMAIL
  && process.env.FIREBASE_PRIVATE_KEY
  && process.env.FIREBASE_DATABASE
  ) {
    Hub.addAction(new FirebaseAction())
    winston.warn(`${LOG_PREFIX} Action registered.`)
} else {
    winston.warn(`${LOG_PREFIX} Action not registered because required environment variables are missing.`)
}
