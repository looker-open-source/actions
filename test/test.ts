import * as chai from "chai"
import * as winston from "winston"
import ChaiHttp = require("chai-http")

chai.use(ChaiHttp)
winston.remove(winston.transports.Console)

import "../src/integrations/index"

import "./test_server"
import "./test_smoke"
