import * as bodyParser from "body-parser"
import * as dotenv from "dotenv"
import * as express from "express"
import * as path from "path"
import * as winston from "winston"

import * as D from "../framework"
import * as apiKey from "./api_key"

const TOKEN_REGEX = new RegExp(/[T|t]oken token="(.*)"/)

export default class Server implements D.IRouteBuilder {

  static run() {
    dotenv.config()

    if (!process.env.BASE_URL) {
      throw new Error("No BASE_URL environment variable set.")
    }
    if (!process.env.INTEGRATION_PROVIDER_LABEL) {
      throw new Error("No INTEGRATION_PROVIDER_LABEL environment variable set.")
    }
    if (!process.env.INTEGRATION_SERVICE_SECRET) {
      throw new Error("No INTEGRATION_SERVICE_SECRET environment variable set.")
    }
    if (process.env.INTEGRATION_SERVICE_DEBUG) {
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
      winston.info(`Integration Server listening on port ${port}!`)
    })
  }

  app: express.Application

  constructor() {

    this.app = express()
    this.app.use(bodyParser.json({limit: "250mb"}))
    this.app.use(express.static("public"))

    this.route("/", async (_req, res) => {
      const integrations = await D.allIntegrations()
      const response = {
        integrations: integrations.map((d) => d.asJson(this)),
        label: process.env.INTEGRATION_PROVIDER_LABEL,
      }
      res.json(response)
      winston.debug(`response: ${JSON.stringify(response)}`)
    })

    this.route("/integrations/:integrationId", async (req, res) => {
      const destination = await D.findDestination(req.params.integrationId)
      res.json(destination.asJson(this))
    })

    this.route("/integrations/:integrationId/action", async (req, res) => {
      const destination = await D.findDestination(req.params.integrationId)
      if (destination.hasAction) {
         const actionResponse = await destination.validateAndPerformAction(D.DataActionRequest.fromRequest(req))
         res.json(actionResponse.asJson())
      } else {
        throw "No action defined for destination."
      }
    })

    this.route("/integrations/:integrationId/form", async (req, res) => {
      const destination = await D.findDestination(req.params.integrationId)
      if (destination.hasForm) {
         const form = await destination.validateAndFetchForm(D.DataActionRequest.fromRequest(req))
         res.json(form.asJson())
      } else {
        throw "No form defined for destination."
      }
    })

    // To provide a health or version check endpoint you should place a status.json file
    // into the project root, which will get served by this endpoint (or 404 otherwise).
    this.app.get("/status", (_req, res) => {
      res.sendFile(path.resolve(`${__dirname}/../status.json`))
    })

  }

  actionUrl(integration: D.Integration) {
    return this.absUrl(`/integrations/${encodeURIComponent(integration.name)}/action`)
  }

  formUrl(integration: D.Integration) {
    return this.absUrl(`/integrations/${encodeURIComponent(integration.name)}/form`)
  }

  private route(urlPath: string, fn: (req: express.Request, res: express.Response) => Promise<void>): void {
    this.app.post(urlPath, async (req, res) => {
      winston.info(`Starting request for ${req.url}`)

      const tokenMatch = (req.header("authorization") || "").match(TOKEN_REGEX)
      if (!tokenMatch || !apiKey.validate(tokenMatch[1])) {
        res.status(403)
        res.json({success: false, error: "Invalid 'Authorization' header."})
        winston.info(`Unauthorized request for ${req.url}`)
        return
      }

      try {
        await fn(req, res)
        winston.info(`Completed request for ${req.url}`)
      } catch (e) {
        winston.error(`Error on request for ${req.url}:`)
        if (typeof(e) === "string") {
          res.status(404)
          res.json({success: false, error: e})
          winston.error(e)
        } else {
          res.status(500)
          res.json({success: false, error: "Internal server error."})
          winston.error(e)
        }
      }
    })
  }

  private absUrl(rootRelativeUrl: string) {
    return `${process.env.BASE_URL}${rootRelativeUrl}`
  }

}
