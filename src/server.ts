import * as bodyParser from "body-parser"
import * as express from "express"
import * as path from "path"
import * as winston from "winston"
import * as apiKey from "./api_key"
import * as D from "./framework"
import "./integrations/index"

const TOKEN_REGEX = new RegExp(/[T|t]oken token="(.*)"/)

export class Server {

  static bootstrap() {
    return new Server()
  }

  static absUrl(rootRelativeUrl: string) {
    return `${process.env.BASE_URL}${rootRelativeUrl}`
  }

  app: express.Application

  constructor() {

    this.app = express()
    this.app.use(bodyParser.json({limit: "250mb"}))
    this.app.use(express.static("public"))
    this.app.use(new RegExp("\/((?!status).)*"), this.authorization)
    this.app.use(this.authorization)
    this.app.use(this.errorHandler)
    this.app.use(this.requestLogger)

    this.app.post("/", async (_req, res) => {
      const integrations = await D.allIntegrations()
      const response = {
        integrations: integrations.map((d) => d.asJson()),
        label: process.env.INTEGRATION_PROVIDER_LABEL,
      }
      res.json(response)
      winston.debug(`response: ${JSON.stringify(response)}`)
    })

    this.app.post("/integrations/:integrationId", async (req, res) => {
      const destination = await D.findDestination(req.params.integrationId)
      res.json(destination.asJson())
    })

    this.app.post("/integrations/:integrationId/action", async (req, res) => {
      const destination = await D.findDestination(req.params.integrationId)
      if (destination.hasAction) {
         const actionResponse = await destination.validateAndPerformAction(D.DataActionRequest.fromRequest(req))
         res.json(actionResponse.asJson())
      } else {
        throw "No action defined for destination."
      }
    })

    this.app.post("/integrations/:integrationId/form", async (req, res) => {
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

  private authorization(req: express.Request, res: express.Response, next: express.NextFunction) {
    const tokenMatch = (req.header("authorization") || "").match(TOKEN_REGEX)
    if (!tokenMatch || !apiKey.validate(tokenMatch[1])) {
      res.status(403)
      res.json({success: false, error: "Invalid 'Authorization' header."})
      res.end()
      winston.info(`Unauthorized request for ${req.url}`)
      return
    }

    next()
  }

  private errorHandler(err: any, req: express.Request, res: express.Response, _next: express.NextFunction) {
    winston.error(`Error on request for ${req.url}:`)
    if (typeof(err) === "string") {
      res.status(404)
      res.json({success: false, error: err})
      winston.error(err)
    } else {
      res.status(500)
      res.json({success: false, error: "Internal server error."})
      winston.error(err)
    }
  }

  private requestLogger(req: express.Request, _res: express.Response, next: express.NextFunction) {
    winston.info(`Starting request for ${req.url}`)
    next()
    winston.info(`Completed request for ${req.url}`)
  }
}
