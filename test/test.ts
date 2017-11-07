import * as chai from "chai"
import * as sinonChai from "sinon-chai"
import * as winston from "winston"

const chaiAsPromised = require("chai-as-promised")
const chaiHttp = require("chai-http")

chai.use(chaiHttp)
chai.use(sinonChai)
chai.use(chaiAsPromised) // should be last
winston.remove(winston.transports.Console)

import "../src/integrations/index"

import "./test_server"
import "./test_smoke"

import "../src/integrations/airtable/test_airtable"
import "../src/integrations/amazon/test_amazon_ec2"
import "../src/integrations/amazon/test_amazon_s3"
import "../src/integrations/azure/test_azure_storage"
import "../src/integrations/digitalocean/test_digitalocean_droplet"
import "../src/integrations/digitalocean/test_digitalocean_object_storage"
import "../src/integrations/hipchat/test_hipchat"
import "../src/integrations/jira/test_jira"
import "../src/integrations/segment/test_segment"
import "../src/integrations/sendgrid/test_sendgrid"
import "../src/integrations/sftp/test_sftp"
import "../src/integrations/slack/test_slack"
import "../src/integrations/tray/test_tray"
import "../src/integrations/twilio/test_twilio"
import "../src/integrations/twilio/test_twilio_message"
import "../src/integrations/webhook/test_webhook"
import "../src/integrations/zapier/test_zapier"
