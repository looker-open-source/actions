import * as dotenv from "dotenv";
import * as winston from "winston";
import { Server } from "./server";

dotenv.config();

if (!process.env.BASE_URL) {
  throw new Error("No BASE_URL environment variable set.");
}

let app = Server.bootstrap().app;
let port = process.env.PORT || 8080;
app.listen(port, () => {
  winston.info(`Integration Server listening on port ${port}!`);
});
