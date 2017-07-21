import * as chai from "chai"

import "../src/integrations/index"

import ChaiHttp = require("chai-http")
chai.use(ChaiHttp)

import "./test_server"
import "./test_smoke"
