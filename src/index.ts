import * as dotenv from "dotenv"
import * as winston from "winston"
import { Server } from "./server"

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

const app = Server.bootstrap().app
const port = process.env.PORT || 8080
app.listen(port, () => {
  winston.info(`Integration Server listening on port ${port}!`)
})
