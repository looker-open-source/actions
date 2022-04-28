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
    let data: any = {}
    if (request.formParams.data) {
      data = request.formParams.data
      if (!data.alertId) {
        throw "Need Valid AlertId."
      }
    } else {
      throw "Need valid notification data."
    }
    await this.verifyAndSendMessage(request.formParams)
    return new Hub.ActionResponse(response)
  }

  async verifyAndSendMessage(params: Hub.ParamMap): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const data: any = params.data
      if (!params.title) {
        reject("Needs a valid title.")
      }
      if (!params.deviceIds) {
        resolve()
      }
      const notification: any = {title: params.title}
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
          resolve()
        }
        for (const userDevices of userObj) {
          const devices = userDevices as any[]
          for (const device of devices) {
            if (device.device_id && device.user_id) {
              const deviceId = device.device_id.toString()
              notificationData.userId = device.user_id.toString()
              const payload = {
                notification,
                data: notificationData,
              }
              try {
                await this.sendMessageToDevice(deviceId, payload, notificationOptions)
              } catch (error) {
                reject(error)
              }
            }
          }
        }
      } catch (error) {
        reject(error)
      }
      resolve()
    })
    .catch((error) => {
      throw error
    })
  }

  async sendMessageToDevice(deviceId: string,
                            payload: firebaseAdmin.messaging.MessagingPayload,
                            options?: firebaseAdmin.messaging.MessagingOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      FirebaseAction.setFirebaseClient()
      firebaseAdmin.messaging().sendToDevice(deviceId, payload, options)
        .then( (_: any) => {
          resolve()
        })
        .catch( (error: any) => {
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
} else {
    winston.warn(`${LOG_PREFIX} Action not registered because required environment variables are missing.`)
}
