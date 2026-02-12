import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../src/hub"
import { ActionCrypto } from "../src/hub"

class TestOAuthAction extends Hub.OAuthAction {
  name = "test_oauth"
  label = "Test OAuth"
  description = "Test OAuth Action"
  supportedActionTypes = [Hub.ActionType.Dashboard]
  params = []

  async execute(_request: Hub.ActionRequest) {
    return new Hub.ActionResponse()
  }

  async form(_request: Hub.ActionRequest) {
    return new Hub.ActionForm()
  }

  async oauthCheck(_request: Hub.ActionRequest) {
    return true
  }

  async oauthUrl(_redirectUri: string, _encryptedState: string) {
    return ""
  }

  async oauthFetchInfo(_urlParams: { [key: string]: string }, _redirectUri: string) {
    // pass
  }
}

describe("OAuthAction Encryption", () => {
  let action: TestOAuthAction
  let encryptStub: sinon.SinonStub
  let decryptStub: sinon.SinonStub

  beforeEach(() => {
    action = new TestOAuthAction()
    encryptStub = sinon.stub(ActionCrypto.prototype, "encrypt").resolves("encrypted_data")
    decryptStub = sinon.stub(ActionCrypto.prototype, "decrypt").resolves(JSON.stringify({ tokens: "secret" }))
    process.env.CIPHER_MASTER = "secret"
    process.env.CIPHER_PASSWORD = "password"
  })

  afterEach(() => {
    encryptStub.restore()
    decryptStub.restore()
    process.env.ENCRYPT_PAYLOAD = "false"
    delete process.env.CIPHER_MASTER
    delete process.env.CIPHER_PASSWORD
  })

  describe("oauthMaybeEncryptTokens", () => {
    it("returns plain JSON when actions specific env var is not set (defaults to false)", async () => {
      // Even if global is true, we should default to false for OAuthAction if specific var is missing
      process.env.ENCRYPT_PAYLOAD = "true"
      const payload = { tokens: "secret" }
      const result = await action.oauthMaybeEncryptTokens(payload, "webhookId")
      chai.expect(result).to.equal(JSON.stringify(payload))
      sinon.assert.notCalled(encryptStub)
    })

    it("returns EncryptedPayload when action specific env var is true", async () => {
      process.env.ENCRYPT_PAYLOAD_TEST_OAUTH = "true"
      const payload = { tokens: "secret" }
      const result = await action.oauthMaybeEncryptTokens(payload, "webhookId")
      chai.expect(result).to.be.instanceOf(Hub.EncryptedPayload)
      if (result instanceof Hub.EncryptedPayload) {
        chai.expect(result.payload).to.equal("encrypted_data")
      }
      sinon.assert.calledOnce(encryptStub)
      delete process.env.ENCRYPT_PAYLOAD_TEST_OAUTH
    })


  })

  describe("oauthExtractTokensFromStateJson", () => {
    it("extracts unencrypted tokens", async () => {
      const state = { tokens: "secret" }
      const result = await action.oauthExtractTokensFromStateJson(JSON.stringify(state), "webhookId")
      chai.expect(result).to.deep.equal(state)
    })

    it("decrypts encrypted tokens", async () => {
      const state = { cid: "cid", payload: "encrypted_payload" }
      const result = await action.oauthExtractTokensFromStateJson(JSON.stringify(state), "webhookId")
      chai.expect(result).to.deep.equal({ tokens: "secret" })
      sinon.assert.calledWith(decryptStub, "encrypted_payload")
    })

    it("returns null on invalid JSON", async () => {
      const result = await action.oauthExtractTokensFromStateJson("invalid_json", "webhookId")
      chai.expect(result).to.be.null
    })

    it("returns null on decryption failure", async () => {
      decryptStub.rejects(new Error("Decryption failed"))
      const state = { cid: "cid", payload: "encrypted_payload" }
      const result = await action.oauthExtractTokensFromStateJson(JSON.stringify(state), "webhookId")
      chai.expect(result).to.be.null
    })
  })
})
