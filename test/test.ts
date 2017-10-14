import * as chai from "chai"
import chaiAsPromised = require("chai-as-promised")
import ChaiHttp = require("chai-http")
import * as sinonChai from "sinon-chai"
import * as winston from "winston"

chai.use(ChaiHttp)
chai.use(sinonChai)
chai.use(chaiAsPromised) // should be last
winston.remove(winston.transports.Console)

import "../src/integrations/index"

import "./test_server"
import "./test_smoke"

import "./integrations/test_airtable"
import "./integrations/test_hipchat"
import "./integrations/test_jira"
import "./integrations/test_segment"
import "./integrations/test_slack"
import "./integrations/test_tray"
import "./integrations/test_webhook"
import "./integrations/test_zapier"
