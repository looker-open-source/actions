import "dotenv/config"
import "./actions"
import { registerDebugAction } from "./actions/debug/debug"
import Server from "./server/server"

Server.run()

registerDebugAction()
