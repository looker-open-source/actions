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
const crypto = require("crypto")
const qs = require("qs")
const nodeRequest = require("request")

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
        autoBreadcrumbs: true,
        environment: process.env.ACTION_HUB_BASE_URL,
      }).install()
    }

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
      winston.info(`Action Hub listening!`, { port })
    })
  }

  app: express.Application

  constructor() {

    this.app = express()
    if (useRaven()) {
      this.app.use(Raven.requestHandler())
      this.app.use(Raven.errorHandler())
    }
    this.app.use(bodyParser.json({ limit: "250mb" }))
    this.app.use(expressWinston.logger({
      winstonInstance: winston,
      dynamicMeta: this.requestLog,
      requestFilter(req: { [key: string]: any }, propName: string) {
        if (propName !== "headers") {
          return req[propName]
        }
      },
    }))
    this.app.use(express.static("public"))

    this.route("/", async (req, res) => {
      const request = Hub.ActionRequest.fromRequest(req)
      const actions = await Hub.allActions({ lookerVersion: request.lookerVersion })
      const response = {
        integrations: actions.map((d) => d.asJson(this)),
        label: process.env.ACTION_HUB_LABEL,
      }
      res.json(response)
      winston.debug(`response: ${JSON.stringify(response)}`)
    })

    this.route("/actions/:actionId", async (req, res) => {
      const request = Hub.ActionRequest.fromRequest(req)
      const action = await Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion })
      res.json(action.asJson(this))
    })

    this.route("/actions/:actionId/execute", async (req, res) => {
      const request = Hub.ActionRequest.fromRequest(req)
      const action = await Hub.findAction(req.params.actionId, { lookerVersion: request.lookerVersion })
      if (action.hasExecute) {
        const actionResponse = await action.validateAndExecute(request)
        res.json(actionResponse.asJson())
      } else {
        throw "No action defined for action."
      }
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

    function renderError(error: any) {
      return `
        <html>
          <head>
            <title>An Error Occurred.</title>
            <link rel="stylesheet" href="/install/workplace/styles.css" />
          </head>
          <body class="error">
            <h1>Sorry, an error occurred:</h1>
            <div class="error-message">
              ${JSON.stringify(error)}
            </div>
          </body>
        </html>
      `
    }

    function renderSuccess({ accessToken }: any) {
      /* tslint:disable */
      return `
        <html>
          <head>
            <title>Success</title>
            <link rel="stylesheet" href="/install/workplace/styles.css" />
          </head>
          <body class="success">
            <h1>Your Access Token:</h1>
            <div class="access-token">${accessToken}</div>

            <h2>Please copy and paste this token into the Workplace by Facebook Action config settings in your Looker instance.</h2>

            <img src="/install/workplace/instruction-1.png" alt="Edit Workplace by Facebook Action in Looker instance" />

            <img src="/install/workplace/instruction-2.png" alt="Paste Access Token and Save" />

          </body>
        </html>
      `
      /* tslint:enable */
    }

    // ported from https://github.com/jokr/workplace-demo-authentication
    this.app.get("/actions/workplace/install", (req, res) => {
      try {
        if (!req.query.code) {
          return res
            .status(400)
            .send(renderError({ message: "No code received." }))
        }
        const baseURL = process.env.FACEBOOK_GRAPH_URL || "https://graph.facebook.com"
        const tokenQueryString = qs.stringify({
          client_id: process.env.WORKPLACE_APP_ID,
          client_secret: process.env.WORKPLACE_APP_SECRET,
          redirect_uri: process.env.WORKPLACE_APP_REDIRECT,
          code: req.query.code,
          scope: "manage_pages publish_pages",
        })
        nodeRequest(
          baseURL + "/oauth/access_token?" + tokenQueryString,
          (tokenErr: any, tokenResponse: any, tokenBody: any) => {
            try {
              if (tokenErr) {
                return res
                  .status(500)
                  .send(renderError({
                    message: "Error when sending request for access token.",
                    code: tokenErr,
                  }))
              }
              const parsedTokenBody = JSON.parse(tokenBody)
              if (tokenResponse.statusCode !== 200) {
                return res
                  .status(500)
                  .send(renderError({
                    message: "Access token exchange failed.",
                    code: JSON.stringify(parsedTokenBody.error),
                  }))
              }

              const accessToken = parsedTokenBody.access_token
              if (!accessToken) {
                return res
                  .status(500)
                  .send(renderError({
                    message: "Response did not contain an access token.",
                  }))
              }
              const appsecretTime = Math.floor(Date.now() / 1000)
              const appsecretProof = crypto
                .createHmac("sha256", process.env.WORKPLACE_APP_SECRET)
                .update(accessToken + "|" + appsecretTime)
                .digest("hex")
              const companyQueryString = qs.stringify({
                fields: "name",
                access_token: accessToken,
                appsecret_proof: appsecretProof,
                appsecret_time: appsecretTime,
              })

              nodeRequest(
                baseURL + "/company?" + companyQueryString,
                (companyErr: any, companyResponse: any, companyBody: any) => {
                  try {
                    if (companyErr) {
                      return res
                        .status(500)
                        .send(renderError({
                          message: "Error when sending a graph request.",
                          code: companyErr,
                        }))
                    }
                    const parsedCompanyBody = JSON.parse(companyBody)
                    if (companyResponse.statusCode !== 200) {
                      return res
                        .status(500)
                        .send(renderError({
                          message: "Graph API returned an error.",
                          code: JSON.stringify(parsedCompanyBody.error),
                        }))
                    }

                    return res.send(renderSuccess({
                      companyName: parsedCompanyBody.name,
                      accessToken,
                    }))
                  } catch (companyRequestError) {
                    // console.error(companyRequestError)
                    res.send(renderError({ companyRequestError }))
                  }
                },
              )
            } catch (accessTokenRequestError) {
              // console.error(accessTokenRequestError)
              res.send(renderError({ accessTokenRequestError }))
            }
          },
        )
      } catch (outerRequestError) {
        // console.error(outerRequestError)
        res.send(renderError({ outerRequestError }))
      }
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

      if (useRaven()) {
        const data = this.requestLog(req, res)
        Raven.setContext({
          instanceId: data.instanceId,
          webhookId: data.webhookId,
        })
      }

      const tokenMatch = (req.header("authorization") || "").match(TOKEN_REGEX)
      if (!tokenMatch || !apiKey.validate(tokenMatch[1])) {
        res.status(403)
        res.json({ success: false, error: "Invalid 'Authorization' header." })
        this.logInfo(req, res, "Unauthorized request.")
        return
      }

      try {
        await fn(req, res)
      } catch (e) {
        this.logError(req, res, "Error on request")
        if (typeof (e) === "string") {
          res.status(404)
          res.json({ success: false, error: e })
          this.logError(req, res, e)
        } else {
          res.status(500)
          res.json({ success: false, error: "Internal server error." })
          this.logError(req, res, e)
          if (useRaven()) {
            Raven.captureException(e)
          }
        }
      }

      if (useRaven()) {
        Raven.setContext({})
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
