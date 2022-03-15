	import * as Hub from "../../hub"
	import * as admin from 'firebase-admin';
	import * as app from 'firebase-admin/app';

	export class FirebaseAction extends Hub.Action {

	  name = "firebase"
	  label = "Firebase"
	  iconName = "firebase/firebase.png"
	  description = "Use firebase to send push notifications to mobile."
	  storageBucket = process.env.FIREBASE_BUCKET
	  contentType = "image/jpeg"
	  notificationOptions = {
      priority: "high",
      timeToLive: 60 * 60 * 24,
      contentAvailable: true,
      mutableContent: true
	  }
	  static firebaseAdmin: app.App
	  params = []
	  supportedActionTypes = [Hub.ActionType.Query]
	  supportedFormats = [Hub.ActionFormat.JsonDetail]
	  supportedFormattings = [Hub.ActionFormatting.Unformatted]
	  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

    static setFirebaseClient() {
      if (!FirebaseAction.firebaseAdmin) {
        FirebaseAction.firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
          }),
          databaseURL: process.env.FIREBASE_DATABASE,
        });
      }
    }

	  async execute(request: Hub.ActionRequest) {
      let response = new Hub.ActionResponse({success: true})
      let data: any = {}
      if (request.formParams.data) {
        data = request.formParams.data
        if (!data.alertId) {
          throw "Need Valid AlertId."
        }
      } else {
        throw "Need valid notification data."
      }
      let imageName = await this.uploadImage(request)
      await this.verifyAndSendMessage(request.formParams, imageName)
      return new Hub.ActionResponse(response)
	  }

    async verifyAndSendMessage(params: Hub.ParamMap, imageName: string): Promise<any> {
      return new Promise(async (resolve, reject) => {
        let data: any = params.data
        if (!params.title) {
          reject("Needs a valid title.")
        }
        if (!params.deviceIds) {
          resolve()
        }
        let notification: any = {title: params.title}
        let notificationData: any = data
        notificationData.imageUrl = imageName
        if (params.timeToLive) {
          this.notificationOptions.timeToLive = parseFloat(params.timeToLive)
        }
        if (params.priority) {
          this.notificationOptions.priority = params.priority
        }
        try {
          const userObj = JSON.parse(params.deviceIds ?? "[]") as any[]
          let deviceIdObject = params.deviceIds as unknown as any[]
          if (deviceIdObject.length == 0) {
            resolve()
          }
          for (let userDevices of userObj) {
            let devices = userDevices as any[]
            for (let device of devices) {
              if (device.device_id && device.user_id) {
                let deviceId = device.device_id.toString()
                notificationData.userId = device.user_id.toString()
                let payload = {
                  notification: notification,
                  data: notificationData
                };
                try {
                  await this.sendMessageToDevice(deviceId, payload, this.notificationOptions)
                }
                catch (error) {
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

    async sendMessageToDevice(deviceId: string, payload: admin.messaging.MessagingPayload, options?: admin.messaging.MessagingOptions): Promise<any> {
      return new Promise((resolve, reject) => {
        FirebaseAction.setFirebaseClient()
        admin.messaging().sendToDevice(deviceId, payload, options)
          .then( (_: any) => {
            resolve()
          })
          .catch( (error: any) => {
            reject(error.message)
          });
      })
      .catch((error) => {
        throw error
      });
    }

    async uploadImage(request: Hub.ActionRequest): Promise<any> {
      let data = request.formParams.data as any

      if (request.attachment?.dataBuffer) {
        return new Promise((resolve, reject) => {
          FirebaseAction.setFirebaseClient()
          let dateString = new Date().toISOString()
          let alertId = data.alertId ?? ""
          let instance = data.instance ?? ""
          const destFileName = instance + dateString + alertId;
          const fileCloud = admin.storage().bucket(this.storageBucket).file(destFileName);
            fileCloud.save(request.attachment?.dataBuffer!, {
              metadata: {
                contentType: this.contentType
              }
            }, (err) => {
            if (err) {
              reject(err)
            }
            resolve(destFileName)
          });
        })
      } else {
        throw "Need valid image data"
      }
    }

    async form() {
      const form = new Hub.ActionForm()
      form.fields = []
      return form
	  }
	}

	Hub.addAction(new FirebaseAction())
