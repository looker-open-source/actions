import * as bodyParser from "body-parser"
import * as dotenv from "dotenv"
import * as express from "express"
import * as fs from "fs"
import * as path from "path"
import * as Raven from "raven"
import * as winston from "winston"

import * as Hub from "../hub"
import * as apiKey from "./api_key"

const expressWinston = require("express-winston")
const blocked = require("blocked-at")

const TOKEN_REGEX = new RegExp(/[T|t]oken token="(.*)"/)
const statusJsonPath = path.resolve(`${__dirname}/../../status.json`)
const useRaven = () => !!process.env.ACTION_HUB_RAVEN_DSN

export default class Server implements Hub.RouteBuilder {

  static run() {
    dotenv.config()

    if (useRaven()) {
      let statusJson: any = {}
      if (fs.existsSync(statusJsonPath)) {
        statusJson = JSON.parse(fs.readFileSync(statusJsonPath).toString())
      }
      Raven.config(process.env.ACTION_HUB_RAVEN_DSN, {
        captureUnhandledRejections: true,
        release: statusJson.git_commit,
        autoBreadcrumbs: false,
        environment: process.env.ACTION_HUB_BASE_URL,
      }).install()
    }

    blocked((time: number, stack: string[]) => {
      winston.warn(`Event loop blocked for ${time}ms, operation started here:\n${stack.join("\n")}`)
    }, {threshold: 100})

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

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080
    Server.listen(port)
  }

  static listen(port: number) {
    const app = new Server().app
    app.listen(port, () => {
      winston.info(`Action Hub listening!`, {port})
    })
  }

  app: express.Application

  private actionList?: string = undefined

  constructor() {

    this.app = express()
    this.app.use(bodyParser.json({limit: "250mb"}))
    this.app.use(expressWinston.logger({
      winstonInstance: winston,
      dynamicMeta: this.requestLog,
      requestFilter(req: {[key: string]: any}, propName: string) {
        if (propName !== "headers") {
          return req[propName]
        }
      },
    }))
    this.app.use(express.static("public"))

    this.route("/", async (req, res) => {
      if (!this.actionList) {
        const request = Hub.ActionRequest.fromRequest(req)
        const actions = await Hub.allActions({ lookerVersion: request.lookerVersion })
        const response = {
          integrations: actions.map((d) => d.asJson(this)),
          label: process.env.ACTION_HUB_LABEL,
        }
        this.actionList = JSON.stringify(response)
      }
      res.type("json")
      res.send(this.actionList)
      winston.debug(`response: ${this.actionList}`)
    })

    this.route("/actions/:actionId", async (req, res) => {
      const request = Hub.ActionRequest.fromRequest(req)
      const action = await Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion })
      res.json(action.asJson(this))
    })

    this.route("/actions/:actionId/execute", async (req, res) => {
      const request = Hub.ActionRequest.fromRequest(req)
      const action = await Hub.findAction(req.params.actionId, {lookerVersion: request.lookerVersion})
      const actionResponse = await action.validateAndExecute(request)

      // Some versions of Looker do not look at the "success" value in the response
      // if the action returns a 200 status code, even though the Action API specs otherwise.
      // So we force a non-200 status code as a workaround.
      if (!actionResponse.success) {
        res.status(400)
      }
      res.json(actionResponse.asJson())
    })

    this.route("/actions/:actionId/form", async (req, res) => {
      const request = Hub.ActionRequest.fromRequest(req)
      const action = await Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion })
      if (action.hasForm) {
        const form = await action.validateAndFetchForm(request)
        res.json(form.asJson())
      } else {
        throw "No form defined for action."
      }
    })

    // To provide a health or version check endpoint you should place a status.json file
    // into the project root, which will get served by this endpoint (or 404 otherwise).
    this.app.get("/status", (_req, res) => {
      res.sendFile(statusJsonPath)
    })

  }

  actionUrl(action: Hub.Action) {
    return this.absUrl(`/actions/${encodeURIComponent(action.name)}/execute`)
  }

  formUrl(action: Hub.Action) {
    return this.absUrl(`/actions/${encodeURIComponent(action.name)}/form`)
  }

  private route(urlPath: string, fn: (req: express.Request, res: express.Response) => Promise<void>): void {
    this.app.post(urlPath, async (req, res) => {
      this.logInfo(req, res, "Starting request.")

      let ravenTags = {}
      if (useRaven()) {
        ravenTags = this.requestLog(req, res)
      }

      const headerValue = req.header("authorization")
      const tokenMatch = headerValue ? headerValue.match(TOKEN_REGEX) : undefined
      if (!tokenMatch || !apiKey.validate(tokenMatch[1])) {
        res.status(403)
        res.json({success: false, error: "Invalid 'Authorization' header."})
        this.logInfo(req, res, "Unauthorized request.")
        return
      }

      try {
        await fn(req, res)
      } catch (e) {
        this.logError(req, res, "Error on request")
        if (typeof(e) === "string") {
          if (!res.headersSent) {
            res.status(404)
            res.json({success: false, error: e})
          }
          this.logError(req, res, e)
        } else {
          if (!res.headersSent) {
            res.status(500)
            res.json({ success: false, error: "Internal server error." })
          }
          this.logError(req, res, e)
          if (useRaven()) {
            Raven.captureException(e, { tags: ravenTags })
          }
        }
      }

    })
  }

  private logInfo(req: express.Request, res: express.Response, message: any, options: any = {}) {
    winston.info(message, {
      ...options,
      ...this.requestLog(req, res),
    })
  }

  private logError(req: express.Request, res: express.Response, message: any, options: any = {}) {
    winston.error(message, {
      ...options,
      ...this.requestLog(req, res),
    })
  }

  private requestLog(req: express.Request, res: express.Response) {
    return {
      url: req.url,
      ip: req.ip,
      statusCode: res.statusCode,
      instanceId: req.header("x-looker-instance"),
      webhookId: req.header("x-looker-webhook-id"),
    }
  }

  private absUrl(rootRelativeUrl: string) {
    return `${process.env.ACTION_HUB_BASE_URL}${rootRelativeUrl}`
  }

}
