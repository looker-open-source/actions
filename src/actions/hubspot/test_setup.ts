import * as chai from "chai"
import * as chaiAsPromised from "chai-as-promised"
import * as sinonChai from "sinon-chai"
import * as winston from "winston"

const chaiHttp = require("chai-http")

chai.use(chaiHttp)
chai.use(sinonChai)
chai.use(chaiAsPromised) // should be last
winston.remove(winston.transports.Console)
