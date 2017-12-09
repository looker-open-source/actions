import * as bodyParser from "body-parser"
import * as dotenv from "dotenv"
import * as express from "express"
import * as path from "path"
import * as winston from "winston"

import * as Hub from "../hub"
import * as apiKey from "./api_key"

const TOKEN_REGEX = new RegExp(/[T|t]oken token="(.*)"/)

export default class Server implements Hub.RouteBuilder {

  static run() {
    dotenv.config()

    if (!process.env.ACTION_HUB_BASE_URL) {
      throw new Error("No ACTION_HUB_BASE_URL environment variable set.")
    }
    if (!process.env.ACTION_HUB_LABEL) {
      throw new Error("No ACTION_HUB_LABEL environment variable set.")
    }
    if (!process.env.ACTION_HUB_SECRET) {
      throw new Error("No ACTION_HUB_SECRET environment variable set.")
    }
    if (process.env.ACTION_HUB_DEBUG) {
      winston.configure({
        level: "debug",
        transports: [
          new (winston.transports.Console)(),
        ],
      })
      winston.debug("Debug Mode")
    }

    Server.listen()
  }

  static listen(port = process.env.PORT || 8080) {
    const app = new Server().app
    app.listen(port, () => {
      winston.info(`Action Hub listening!`, {port})
    })
  }

  app: express.Application

  constructor() {

    this.app = express()
    this.app.use(bodyParser.json({limit: "250mb"}))
    this.app.use(express.static("public"))

    this.route("/", async (_req, res) => {
      const actions = await Hub.allActions()
      const response = {
        integrations: actions.map((d) => d.asJson(this)),
        label: process.env.ACTION_HUB_LABEL,
      }
      res.json(response)
      winston.debug(`response: ${JSON.stringify(response)}`)
    })

    this.route("/actions/:actionId", async (req, res) => {
      const action = await Hub.findAction(req.params.actionId)
      res.json(action.asJson(this))
    })

    this.route("/actions/:actionId/action", async (req, res) => {
      const action = await Hub.findAction(req.params.actionId)
      if (action.hasExecute) {
         const actionResponse = await action.validateAndExecute(Hub.ActionRequest.fromRequest(req))
         res.json(actionResponse.asJson())
      } else {
        throw "No action defined for action."
      }
    })

    this.route("/actions/:actionId/form", async (req, res) => {
      const action = await Hub.findAction(req.params.actionId)
      if (action.hasForm) {
         const form = await action.validateAndFetchForm(Hub.ActionRequest.fromRequest(req))
         res.json(form.asJson())
      } else {
        throw "No form defined for action."
      }
    })

    // To provide a health or version check endpoint you should place a status.json file
    // into the project root, which will get served by this endpoint (or 404 otherwise).
    this.app.get("/status", (req, res) => {
      this.logInfo(req, "Status page requested.")
      res.sendFile(path.resolve(`${__dirname}/../status.json`))
    })

  }

  actionUrl(action: Hub.Action) {
    return this.absUrl(`/actions/${encodeURIComponent(action.name)}/action`)
  }

  formUrl(action: Hub.Action) {
    return this.absUrl(`/actions/${encodeURIComponent(action.name)}/form`)
  }

  private route(urlPath: string, fn: (req: express.Request, res: express.Response) => Promise<void>): void {
    this.app.get(urlPath, async (req, res) => {
      this.logInfo(req, "Starting request.")

      const tokenMatch = (req.header("authorization") || "").match(TOKEN_REGEX)
      if (!tokenMatch || !apiKey.validate(tokenMatch[1])) {
        res.status(403)
        res.json({success: false, error: "Invalid 'Authorization' header."})
        this.logInfo(req, "Unauthorized request.")
        return
      }

      try {
        await fn(req, res)
        this.logInfo(req, "Completed request.")
      } catch (e) {
        this.logError(req, "Error on request")
        if (typeof(e) === "string") {
          res.status(404)
          res.json({success: false, error: e})
          this.logError(req, e)
        } else {
          res.status(500)
          res.json({success: false, error: "Internal server error."})
          this.logError(req, e)
        }
      }
    })
  }

  private logInfo(req: express.Request, message: any, options: any = {}) {
    winston.info(message, {
      ...options,
      ...this.requestLog(req),
    })
  }

  private logError(req: express.Request, message: any, options: any = {}) {
    winston.error(message, {
      ...options,
      ...this.requestLog(req),
    })
  }

  private requestLog(req: express.Request) {
    return {
      url: req.url,
      ip: req.ip,
      instanceId: req.header("x-looker-instance"),
      webhookId: req.header("x-looker-webhook-id"),
    }
  }

  private absUrl(rootRelativeUrl: string) {
    return `${process.env.ACTION_HUB_BASE_URL}${rootRelativeUrl}`
  }

}
