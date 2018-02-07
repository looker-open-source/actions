import "./actions"
import {DebugAction} from "./actions/debug/debug"
import * as Hub from "./hub"
import Server from "./server/server"

Server.run()

if (process.env.ACTION_HUB_DEBUG_ENDPOINT) {
  Hub.addAction(new DebugAction())
}
