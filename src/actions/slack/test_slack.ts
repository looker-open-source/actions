import * as chai from "chai"
import * as sinon from "sinon"
import {AESTransitCrypto} from "../../crypto/aes_transit_crypto"

import * as Hub from "../../hub"
import {SlackAction} from "./slack"
import * as SlackClientManager from "./slack_client_manager"
import {isSupportMultiWorkspaces, MULTI_WORKSPACE_SUPPORTED_VERSION} from "./slack_client_manager"
import * as utils from "./utils"

const action = new SlackAction()
action.executeInOwnProcess = false

// @ts-ignore
const stubSlackClient = (sandbox: sinon.SinonSandbox, fn: () => void) => sandbox.stub(SlackClientManager, "makeSlackClient").callsFake(fn)

describe(`${action.constructor.name} tests`, () => {
  let sandbox: sinon.SinonSandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe("isSupportMultiWorkspaces", () => {
    const request = new Hub.ActionRequest()
    request.lookerVersion = "6.24.0"
    chai.expect(isSupportMultiWorkspaces(request)).to.eq(false)

    request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
    chai.expect(isSupportMultiWorkspaces(request)).to.eq(true)
  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })

  describe("oauthCheck", () => {
    it("returns error if the user hasn't authed yet - no state_json", async () => {
      const request = new Hub.ActionRequest()
      const form = await action.oauthCheck(request)

      chai.expect(form).to.deep.equal({
        fields: [],
        error: "You must connect to a Slack workspace first.",
      })
    })

    it("returns error if the user hasn't authed yet - invalid auth", async () => {
      const request = new Hub.ActionRequest()
      request.params = { state_json: "someToken" }

      stubSlackClient(sandbox,
          () => ({
            auth: {
              test: () => { throw Error("An API error occurred: invalid_auth") },
            },
          }),
      )

      const form = await action.oauthCheck(request)

      chai.expect(form).to.deep.equal({
        fields: [],
        error: "Your Slack authentication credentials are not valid.",
      })
    })

    it("returns user logged in info", async () => {
      const request = new Hub.ActionRequest()
      request.params = { state_json: "someToken" }

      stubSlackClient(sandbox,
          () => ({
            auth: {
              test: async () => Promise.resolve({
                ok: true,
                team: "Some Team",
                team_id: "some_team_id",
              }),
            },
          }),
      )

      const form = await action.oauthCheck(request)

      chai.expect(form).to.deep.equal({
        fields: [{
          name: "Connected",
          type: "message",
          value: `Connected with Some Team (some_team_id)`,
        }],
      })
    })
  })

  describe("form", () => {
    it("returns fields correctly from getDisplayedFormFields", async () => {
      sandbox.stub(utils, "getDisplayedFormFields").resolves([
        {
          label: "Super Label",
          type: "string",
          name: "boo",
        },
      ])

      const request = new Hub.ActionRequest()
      request.params = { state_json: "someToken" }

      const form = await action.form(request)

      chai.expect(form).to.deep.equal({
        fields: [{
          label: "Super Label",
          type: "string",
          name: "boo",
        }],
      })
    })

    it("returns error message when getDisplayedFormFields throws and state_url is empty", async () => {
      sandbox.stub(utils, "getDisplayedFormFields").rejects()

      const request = new Hub.ActionRequest()
      const form = await action.form(request)

      chai.expect(form).to.deep.equal({
        fields: [],
        error: "Illegal State: state_url is empty.",
      })
    })

    it("returns log in link when we can't fetch form and state_url is valid", async () => {
      sandbox.stub(utils, "getDisplayedFormFields").rejects()

      const request = new Hub.ActionRequest()
      request.params.state_url = "/flooby"

      const form = await action.form(request)

      chai.expect(form).to.deep.equal({
        state: {},
        fields: [{
          name: "login",
          type: "oauth_link",
          label: "Log in",
          description: "In order to send to a file, you will need to log in to your Slack account.",
          oauth_url: "/flooby",
        }],
      })
    })

    describe("multiple workspaces", () => {
      it("doesn't have any connected workspace", async () => {
        const request = new Hub.ActionRequest()
        request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
        request.params = { state_json: JSON.stringify([]) }
        request.params.state_url = "/flooby"

        const form = await action.form(request)

        chai.expect(form).to.deep.equal({
          state: {},
          fields: [{
            name: "login",
            type: "oauth_link",
            label: "Log in",
            description: "In order to send to a file, you will need to log in to your Slack account.",
            oauth_url: "/flooby",
          }],
        })
      })

      it("default to the first workspace if there is no selected workspace, and fetch form", async () => {
        const defaultWsId = "ws1"

        const request = new Hub.ActionRequest()
        request.params.state_url = "/flooby"
        request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
        request.params = {
          state_json: JSON.stringify([{ install_id: defaultWsId, token: "someToken1"}]),
        }

        stubSlackClient(sandbox, () => ({
          auth: {
            test: () => ({
              ok: true,
              team: "Some Team",
              team_id: defaultWsId,
            }),
          },
        }))

        sandbox.stub(utils, "getDisplayedFormFields").resolves([
          {
            label: "Super Label",
            type: "string",
            name: "boo",
          },
        ])

        const form = await action.form(request)

        chai.expect(form).to.deep.equal({
          fields: [
            {
              default: defaultWsId,
              description: "Name of the Slack workspace you would like to share in.",
              interactive: true,
              label: "Workspace",
              name: "workspace",
              options: [
                {
                  label: "Some Team",
                  name: defaultWsId,
                },
              ],
              required: true,
              type: "select",
            },
            {
              label: "Super Label",
              type: "string",
              name: "boo",
            },
          ],
        })
      })

      it("select the correct workspace and fetch form", async () => {
        const selectedWorkspace = "ws2"

        const request = new Hub.ActionRequest()
        request.params.state_url = "/flooby"
        request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
        request.params = {
          state_json: JSON.stringify([
            { install_id: "ws1", token: "someToken1"},
            { install_id: "ws2", token: "someToken2"},
          ]),
        }
        request.formParams.workspace = selectedWorkspace

        const mockClient2 = {
          auth: {
            test: () => ({ ok: true, team: "WS2", team_id: selectedWorkspace }),
          },
        }

        sandbox.stub(SlackClientManager, "makeSlackClient").callsFake((token) => {
          switch (token) {
            case "someToken1":
              return {
                auth: {
                  test: () => ({ ok: true, team: "WS1", team_id: "ws1" }),
                },
              } as any
            case "someToken2":
              return mockClient2 as any
          }
          return null as any
        })

        sandbox.stub(utils, "getDisplayedFormFields").callsFake((client) => {
          chai.expect(client).to.equal(mockClient2)
          return Promise.resolve([
            {
              label: "Super Label",
              type: "string",
              name: "boo",
            },
          ])
        })

        const form = await action.form(request)

        chai.expect(form).to.deep.equal({
          fields: [
            {
              default: selectedWorkspace,
              description: "Name of the Slack workspace you would like to share in.",
              interactive: true,
              label: "Workspace",
              name: "workspace",
              options: [
                {
                  label: "WS1",
                  name: "ws1",
                },
                {
                  label: "WS2",
                  name: selectedWorkspace,
                },
              ],
              required: true,
              type: "select",
            },
            {
              label: "Super Label",
              type: "string",
              name: "boo",
            },
          ],
        })
      })
    })
  })

  describe("execute", () => {
    let handleExecuteStub: any

    afterEach(() => {
      handleExecuteStub && handleExecuteStub.restore()
    })

    it("has streaming enabled", () => {
      chai.expect(action.usesStreaming).equals(true)
    })

    it("returns error response if no client was selected", async () => {
      const request = new Hub.ActionRequest()
      request.webhookId = "webhookId"

      const form = await action.execute(request)

      chai.expect(form).to.deep.equal({
        refreshQuery: false,
        success: false,
        error: {
          documentation_url: "TODO",
          http_code: 400,
          location: "ActionContainer",
          message: "Server cannot process request due to client request error. [SLACK] Missing client",
          status_code: "BAD_REQUEST",
        },
        message: "Server cannot process request due to client request error. [SLACK] Missing client",
        validationErrors: [],
        webhookId: "webhookId",
      })
    })

    it("returns fields correctly from getDisplayedFormFields", async () => {
      const response = new Hub.ActionResponse({success: true})
      sandbox.stub(utils, "handleExecute").resolves(response)

      const request = new Hub.ActionRequest()

      request.params = { state_json: "someToken" }

      const form = await action.execute(request)

      chai.expect(form).to.deep.equal(response)
    })

    describe("multiple workspaces", () => {
       it("has a selected workspace", async () => {
        const response = new Hub.ActionResponse({success: true})

        sandbox.stub(utils, "handleExecute").resolves(response)

        const request = new Hub.ActionRequest()

        request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION

        request.params = { state_json: JSON.stringify([{ install_id: "ws1", token: "someToken"}]) }
        request.formParams = { workspace: "ws1" }

        const form = await action.execute(request)

        chai.expect(form).to.deep.equal(response)
      })

       it("doesn't have a selected workspace default to the first one", async () => {
         const response = new Hub.ActionResponse({success: true})

         sandbox.stub(utils, "handleExecute").resolves(response)

         const request = new Hub.ActionRequest()
         request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
         request.params = { state_json: JSON.stringify([{ install_id: "ws1", token: "someToken"}]) }

         const form = await action.execute(request)

         chai.expect(form).to.deep.equal(response)
      })

       it("uses the selected workspace if multiple ws is given", async () => {
        const response = new Hub.ActionResponse({success: true})

        const mockClient1 = { id: "I'm mockClient1", token: "some token 1" }
        const mockClient2 = { id: "I'm mockClient2", token: "some token 2" }

        sandbox.stub(SlackClientManager, "makeSlackClient").callsFake((token) => {
          switch (token) {
            case "some token 1":
              return mockClient1 as any
            case "some token 2":
              return mockClient2 as any
          }
          return null as any
        })

        const request = new Hub.ActionRequest()

        request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION

        request.params = {
          state_json: JSON.stringify([
            { install_id: "ws1", token: "some token 1"},
            { install_id: "ws2", token: "some token 2"},
          ]),
        }

        request.formParams = { workspace: "ws2" }

        sandbox.stub(utils, "handleExecute").callsFake((r, client) => {
          chai.expect(r).to.equal(request)
          chai.expect(client).to.equal(mockClient2)
          return Promise.resolve(response)
        })

        const form = await action.execute(request)

        chai.expect(form).to.deep.equal(response)
      })
    })
  })
  describe("Token Encryption", () => {
    let originalCipherMaster: string | undefined
    let originalEncryptPayload: string | undefined

    beforeEach(() => {
      originalCipherMaster = process.env.CIPHER_MASTER
      originalEncryptPayload = process.env.ENCRYPT_PAYLOAD_SLACK_APP
      process.env.CIPHER_MASTER = "0000000000000000000000000000000000000000000000000000000000000000"
      process.env.ENCRYPT_PAYLOAD_SLACK_APP = "true"
    })

    afterEach(() => {
      process.env.CIPHER_MASTER = originalCipherMaster
      process.env.ENCRYPT_PAYLOAD_SLACK_APP = originalEncryptPayload
    })

    /**
     * Tests that when plain text state is received and encryption is enabled,
     * the action returns an ActionState with the encrypted payload.
     */
    it("should read unencrypted state and return encrypted state", async () => {
      const mockClient = { auth: { test: sinon.stub().resolves({ ok: true, team: "test", team_id: "T123" }) } }
      sandbox.stub(SlackClientManager, "makeSlackClient").returns(mockClient as any)

      const request = new Hub.ActionRequest()
      request.params = {
        state_json: "plain-token",
      }

      const response = await action.oauthCheck(request)
      chai.expect(response.fields.some((f: any) => f.name === "Connected")).to.be.true
      chai.expect(response.state).to.be.an.instanceOf(Hub.ActionState)
      chai.expect(response.state!.data).to.not.equal(request.params.state_json)
      chai.expect(response.state!.data!.startsWith("1")).to.be.true
    })

    /**
     * Tests that when encrypted state is received, the action correctly
     * decrypts it before passing it to the Slack client manager.
     */
    it("should decrypt encrypted state", async () => {
      const crypto = new AESTransitCrypto()
      const plainState = "secret-token"
      const encState = await crypto.encrypt(plainState)

      const request = new Hub.ActionRequest()
      request.params = {
        state_json: encState,
      }

      const mockClient = { auth: { test: sinon.stub().resolves({ ok: true, team: "test", team_id: "T123" }) } }
      sandbox.stub(SlackClientManager, "makeSlackClient").callsFake((p) => {
        chai.expect(p).to.equal(plainState)
        return mockClient as any
      })

      await action.oauthCheck(request)
    })
  })
})
