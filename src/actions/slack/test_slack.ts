import * as b64 from "base64-url"
import * as chai from "chai"
import * as sinon from "sinon"

import concatStream = require("concat-stream")

import * as Hub from "../../hub"

import { ActionCrypto } from "../../hub"

import { SlackAttachmentAction } from "./slack"

import { FilesUploadArguments } from "@slack/client"

// for api param to be not required
process.env.SLACK_CLIENT = "1"
process.env.SLACK_SECRET = "2"

const action = new SlackAttachmentAction()

const stubFileName = "stubSuggestedFilename"

function expectSlackMatch(request: Hub.ActionRequest, optionsMatch: FilesUploadArguments) {
  const expectedBuffer = optionsMatch.file as Buffer
  delete optionsMatch.file

  const filesUploadSpy = sinon.spy(async (params: any) => {
    params.media.body.pipe(concatStream((buffer) => {
      chai.expect(buffer.toString()).to.equal(expectedBuffer.toString())
    }))
    return { promise: async () => Promise.resolve() }
  })

  const stubClient = sinon.stub(action as any, "slackClientFromRequest")
    .callsFake(() => ({
      files: {
        upload: filesUploadSpy,
      },
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => stubFileName)

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(filesUploadSpy).to.have.been.calledWithMatch(optionsMatch)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {
  let encryptStub: any
  let decryptStub: any

  beforeEach(() => {
    encryptStub = sinon.stub(ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    decryptStub = sinon.stub(ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
  })

  afterEach(() => {
    encryptStub.restore()
    decryptStub.restore()
  })

  describe("action", () => {

    it("errors if there is no channel", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {}
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing channel.")
    })

    it("sends to right body, channel and filename if specified", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        slack_api_token: "token",
      }
      request.formParams = {
        channel: "mychannel",
        filename: "mywackyfilename",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }
      return expectSlackMatch(request, {
        file: request.attachment.dataBuffer,
        filename: request.formParams.filename,
        channels: request.formParams.channel,
        initial_comment: request.formParams.initial_comment,
      })
    })

    it("sends to right body, channel and filename if specified with oauth", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        stateUrl: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        stateJson: `{"access_token": "token"}`,
      }
      request.formParams = {
        channel: "mychannel",
        filename: "mywackyfilename",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }
      return expectSlackMatch(request, {
        file: request.attachment.dataBuffer,
        filename: request.formParams.filename,
        channels: request.formParams.channel,
        initial_comment: request.formParams.initial_comment,
      })
    })

    it("sets state to reset if error in files.upload", (done) => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        stateUrl: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        stateJson: `{"access_token": "token"}`,
      }
      request.formParams = {
        channel: "mychannel",
        filename: "mywackyfilename",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }

      const stubClient = sinon.stub(action as any, "slackClientFromRequest")
        .callsFake(() => ({
          files: {
            upload: async () => Promise.reject({message: "error"}),
          },
        }))

      const resp = action.validateAndExecute(request)
      chai.expect(resp).to.eventually.deep.equal({
        success: false,
        state: {data: "reset"},
        message: "error",
        refreshQuery: false,
        validationErrors: [],
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("sends right body and channel", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        slack_api_token: "token",
      }
      request.formParams = {
        channel: "mychannel",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }
      return expectSlackMatch(request, {
        file: request.attachment.dataBuffer,
        filename: stubFileName,
        channels: request.formParams.channel,
        initial_comment: request.formParams.initial_comment,
      })
    })

    it("returns failure on slack files.upload error", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        slack_api_token: "token",
      }
      request.formParams = {
        channel: "mychannel",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }

      const filesUploadSpy = sinon.spy(async () => Promise.reject({
        type: "CHANNEL_NOT_FOUND",
        message: "Could not find channel mychannel",
      }))

      const stubClient = sinon.stub(action as any, "slackClientFromRequest")
        .callsFake(() => ({
          files: {
            upload: filesUploadSpy,
          },
        }))

      return chai.expect(action.execute(request)).to.eventually.deep.equal({
        success: false,
        message: "Could not find channel mychannel",
        refreshQuery: false,
        validationErrors: [],
      }).then(() => {
        stubClient.restore()
      })
    })

  })

  function expectSlackFormMatch(request: Hub.ActionRequest, match: any, done: MochaDone) {
    const stubClient = sinon.stub(action as any, "slackClientFromRequest")
    .callsFake(() => ({
      channels: {
        list: (filters: any) => {
          if (filters.cursor) {
            return {
              ok: true,
              channels: [
                {id: "3", name: "C", is_member: true},
                {id: "4", name: "D", is_member: true},
              ],
            }
          } else {
            return {
              ok: true,
              channels: [
                {id: "1", name: "A", is_member: true},
                {id: "2", name: "B", is_member: true},
              ],
              response_metadata: {
                next_cursor: "cursor",
              },
            }
          }
        },
      },
      users: {
        list: (filters: any) => {
          if (filters.cursor) {
            return {
              ok: true,
              members: [
                {id: "30", name: "W"},
                {id: "40", name: "X"},
              ],
            }
          } else {
            return {
              ok: true,
                members: [
                  {id: "10", name: "Z"},
                  {id: "20", name: "Y"},
                ],
              response_metadata: {
                next_cursor: "cursor",
              },
            }
          }
        },
      },
    }))

    const form = action.validateAndFetchForm(request)
    chai.expect(form).to.eventually.deep.equal(match).and.notify(stubClient.restore).and.notify(done)
  }

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with correct channels", (done) => {
      const request = new Hub.ActionRequest()
      request.params = {
        slack_api_token: "foo",
      }

      return expectSlackFormMatch(request, {
        fields: [{
          description: "Name of the Slack channel you would like to post to.",
          label: "Share In",
          name: "channel",
          options: [
            {name: "1", label: "#A"},
            {name: "2", label: "#B"},
            {name: "3", label: "#C"},
            {name: "4", label: "#D"},
            {name: "30", label: "@W"},
            {name: "40", label: "@X"},
            {name: "20", label: "@Y"},
            {name: "10", label: "@Z"},
          ],
          required: true,
          type: "select",
        }, {
          label: "Comment",
          type: "string",
          name: "initial_comment",
        }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }],
      }, done)
    })

    it("returns an oauth form on bad login", (done) => {
      const stubClient = sinon.stub(action as any, "slackClientFromRequest")
        .callsFake(() => ({
          channels: {
            list: async () => Promise.reject("haha I failed auth"),
          },
          users: {
            list: async () => Promise.reject("haha I failed auth"),
          },
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"access_token": "token"}`,
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          description: "In order to send to a file, you will need to log in" +
            " once to your Slack account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/slack/oauth?` +
          `state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
          `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {
          data: "reset",
        },
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("does not blow up on bad state JSON and returns an OAUTH form", (done) => {
      const stubClient = sinon.stub(action as any, "slackClientFromRequest")
        .callsFake(() => ({
          channels: {
            list: async () => Promise.reject("haha I failed auth"),
          },
          users: {
            list: async () => Promise.reject("haha I failed auth"),
          },
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"bad": "token"}`,
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          description: "In order to send to a file, you will need to log in" +
            " once to your Slack account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/slack/oauth?` +
            `state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
            `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {
          data: "reset",
        },
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("returns correct fields on oauth success", (done) => {
      const request = new Hub.ActionRequest()
      request.params = {
        stateUrl: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        stateJson: `{"access_token": "token"}`,
      }
      expectSlackFormMatch(request, {
        fields: [{
          description: "Name of the Slack channel you would like to post to.",
          label: "Share In",
          name: "channel",
          options: [
            {name: "1", label: "#A"},
            {name: "2", label: "#B"},
            {name: "3", label: "#C"},
            {name: "4", label: "#D"},
            {name: "30", label: "@W"},
            {name: "40", label: "@X"},
            {name: "20", label: "@Y"},
            {name: "10", label: "@Z"},
          ],
          required: true,
          type: "select",
        }, {
          label: "Comment",
          type: "string",
          name: "initial_comment",
        }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }],
      }, done)
    })
  })

  describe("oauth", () => {
    it("returns correct redirect url", () => {
      process.env.SLACK_CLIENT = "testingclient"
      const prom = action.oauthUrl("https://actionhub.com/actions/slack/oauth_redirect",
        `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`)
      return chai.expect(prom).to.eventually.equal(
        "https://slack.com/oauth/authorize?" +
        "client_id=testingclient&" +
        "redirect_uri=https%3A%2F%2Factionhub.com%2Factions%2Fslack%2Foauth_redirect&" +
        "state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0" +
        "ZS9hc2RmYXNkZmFzZGZhc2RmIn0&" +
        "scope=channels%3Aread%2Cchat%3Awrite%3Auser%2Cfiles%3Awrite%3Auser%2Cgroups%3Aread%2Cusers%3Aread")
    })

    it("correctly handles redirect from authorization server", (done) => {
      const stubReq = sinon.stub(action as any, "slackClient")
        .callsFake(() => ({
          oauth: {
            access: async () => Promise.resolve({access_token: "token"}),
          },
        }))
      const result = action.oauthFetchInfo({code: "code",
        state: `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZh` +
          `c2RmIiwiYXBwIjoibXlrZXkifQ`},
        "redirect")
      chai.expect(result)
        .and.notify(stubReq.restore).and.notify(done)
    })
  })
})
