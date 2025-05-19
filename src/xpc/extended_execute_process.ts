import * as dotenv from "dotenv"
import * as winston from "winston"

import { registerDebugAction } from "../actions/debug/debug"
import "../actions/index.ts"
import * as Hub from "../hub/index"

dotenv.config()
registerDebugAction()

async function execute(jsonPayload: any) {
  const req = JSON.parse(jsonPayload)
  const request = Hub.ActionRequest.fromIPC(req)
  const action = await Hub.findExtendedAction(req.actionId, {lookerVersion: req.lookerVersion})
  if (action === null) {
    throw "action is not extended"
  }
  return action.execute(request)
}

process.on("message", (req) => {
  execute(req)
    .then((val) => { process.send!(val) })
    .catch((err) => {
      let errorString
      if (err instanceof Error) {
          errorString = err.message || err.toString()
      } else if (typeof err === "object" && err !== null) {
          try {
              errorString = JSON.stringify(err)
          } catch (jsonError: any) {
              errorString = `[Object could not be stringified: ${jsonError.message || jsonError.toString()}]`
          }
      } else {
          errorString = String(err)
      }
      winston.error("Error on child: " + errorString)
      process.send!({success: false, message: errorString})
    })
})
