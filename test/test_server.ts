import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../src/hub"
import { OAuthAction } from "../src/hub/oauth_action"
import * as apiKey from "../src/server/api_key"
import Server from "../src/server/server"

import "../src/actions/index"

const chaiHttp = require("chai-http")
chai.use(chaiHttp)

describe("the action hub", () => {

  // Clear out sinon state after each test to ensure hermeticity
  afterEach(() => {
    sinon.restore()
  })

  it("responds to get requests with a nice html page", (done) => {
    chai.request(new Server().app)
      .get("/")
      .end((_err, res) => {
        chai.expect(res).to.have.status(200)
        done()
      })
  })

  it("403s on POST to the root url without authorization", (done) => {
    chai.request(new Server().app)
      .post("/")
      .end((_err, res) => {
        chai.expect(res).to.have.status(403)
        chai.expect(res.body.success).to.equal(false)
        chai.expect(res.body.error).to.equal("Invalid 'Authorization' header.")
        done()
      })
  })

  it("returns a list of actions on POST to the root url with the proper authentication key", (done) => {
    const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
    chai.request(new Server().app)
      .post("/")
      .set("Authorization", 'Token token="foo"')
      .end((_err, res) => {
        chai.expect(res).to.have.status(200)
        chai.expect(res.body.integrations.length).to.be.greaterThan(0)
        stub.restore()
        done()
      })
  })

  it("for looker versions before 5.5 it returns only segment", (done) => {
    const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
    chai.request(new Server().app)
      .post("/")
      .set("Authorization", 'Token token="foo"')
      .set("User-Agent", "LookerOutgoingWebhook/5.0.0")
      .end((_err, res) => {
        chai.expect(res).to.have.status(200)
        chai.expect(res.body.integrations.length).to.equal(1)
        stub.restore()
        done()
      })
  })

  it("when no user agent is present don't filter the integrations", (done) => {
    const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
    chai.request(new Server().app)
      .post("/")
      .set("Authorization", 'Token token="foo"')
      .end((_err, res) => {
        stub.restore()
        chai.expect(res).to.have.status(200)
        chai.expect(res.body.integrations.length).to.be.greaterThan(2)
        done()
      })
  })

  it("when an unknown user agent is present don't filter the integrations", (done) => {
    const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
    chai.request(new Server().app)
      .post("/")
      .set("Authorization", 'Token token="foo"')
      .set("User-Agent", "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko)")
      .end((_err, res) => {
        stub.restore()
        chai.expect(res).to.have.status(200)
        chai.expect(res.body.integrations.length).to.be.greaterThan(2)
        done()
      })
  })

  it("returns more integrations after 5.5", (done) => {
    const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
    chai.request(new Server().app)
      .post("/")
      .set("Authorization", 'Token token="foo"')
      .set("User-Agent", "LookerOutgoingWebhook/5.5.0")
      .end((_err, res) => {
        stub.restore()
        chai.expect(res).to.have.status(200)
        chai.expect(res.body.integrations.length).to.be.greaterThan(2)
        done()
      })
  })

  it("requires the token format", (done) => {
    const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
    chai.request(new Server().app)
      .post("/")
      .set("Authorization", "foo")
      .end((_err, res) => {
        chai.expect(res).to.have.status(403)
        chai.expect(res.body.error).to.equal("Invalid 'Authorization' header.")
        stub.restore()
        done()
      })
  })

  it("returns a correct list of actions on POST // Looker version 6.2", (done) => {
    const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
    let response60 = {}
    let response62 = {}
    chai.request(new Server().app)
      .post("/")
      .set("Authorization", 'Token token="foo"')
      .set("User-Agent", "LookerOutgoingWebhook/6.0.0")
      .end((_err, res) => {
        chai.expect(res).to.have.status(200)
        response60 = res.body
      })
    chai.request(new Server().app)
      .post("/")
      .set("Authorization", 'Token token="foo"')
      .set("User-Agent", "LookerOutgoingWebhook/6.2.0")
      .end((_err, res) => {
        chai.expect(res).to.have.status(200)
        response62 = res.body
        chai.expect(JSON.stringify(response60)).to.not.equal(JSON.stringify(response62))
        stub.restore()
        done()
      })
  })

  describe("OAuth CSRF protection", () => {
    const mockAction = new class extends OAuthAction {
      name = "mock_oauth_action"
      label = "Mock OAuth Action"
      description = "Mock OAuth Action"
      usesCsrfProtection = true
      supportedActionTypes = []
      params = []
      async oauthCheck(_request: Hub.ActionRequest) { return true }
      async oauthUrl(redirectUri: string, encryptedState: string) {
        return `https://example.com/oauth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(encryptedState)}`
      }
      async oauthFetchInfo(_urlParams: { [key: string]: string }, _redirectUri: string) {
        return
      }
      async execute(_request: Hub.ActionRequest) {
        return new Hub.ActionResponse()
      }
    }()

    before(() => {
      Hub.addAction(mockAction)
    })

    beforeEach(() => {
      process.env.ACTION_HUB_BASE_URL = "http://localhost:8080"
    })

    afterEach(() => {
      delete process.env.ACTION_HUB_BASE_URL
    })

    it("sets cookie and redirects in oauth flow", (done) => {
      chai.request(new Server().app)
        .get("/actions/mock_oauth_action/oauth?state=my_state")
        .redirects(0)
        .end((_err, res) => {
          chai.expect(res).to.have.status(302)
          chai.expect(res).to.have.header("set-cookie")
          const cookies = res.header["set-cookie"][0]
          chai.expect(cookies).to.include("action_hub_state=")
          chai.expect(res.header.location).to.include("state=")
          done()
        })
    })

    it("fails oauth_redirect if cookie is missing", (done) => {
      chai.request(new Server().app)
        .get("/actions/mock_oauth_action/oauth_redirect?state=nonce.my_state")
        .end((_err, res) => {
          chai.expect(res).to.have.status(403)
          chai.expect(res.text).to.equal("CSRF validation failed.")
          done()
        })
    })

    it("fails oauth_redirect if state is missing", (done) => {
      chai.request(new Server().app)
        .get("/actions/mock_oauth_action/oauth_redirect")
        .end((_err, res) => {
          chai.expect(res).to.have.status(400)
          done()
        })
    })

    it("fails oauth_redirect if state format is invalid", (done) => {
      chai.request(new Server().app)
        .get("/actions/mock_oauth_action/oauth_redirect?state=invalidstate")
        .end((_err, res) => {
          chai.expect(res).to.have.status(400)
          done()
        })
    })

    it("fails oauth_redirect if nonce mismatches", (done) => {
      chai.request(new Server().app)
        .get("/actions/mock_oauth_action/oauth_redirect?state=wrongnonce.my_state")
        .set("Cookie", "action_hub_state=correctnonce")
        .end((_err, res) => {
          chai.expect(res).to.have.status(403)
          chai.expect(res.text).to.equal("CSRF validation failed.")
          done()
        })
    })

    it("succeeds oauth_redirect if nonce matches", (done) => {
      const oauthFetchInfoStub = sinon.stub(mockAction, "oauthFetchInfo").resolves()
      chai.request(new Server().app)
        .get("/actions/mock_oauth_action/oauth_redirect?state=correctnonce.my_state")
        .set("Cookie", "action_hub_state=correctnonce")
        .end((_err, res) => {
          chai.expect(res).to.have.status(200)
          chai.expect(oauthFetchInfoStub.calledOnce).to.be.true
          oauthFetchInfoStub.restore()
          done()
        })
    })

    describe("Secure cookie flags", () => {
      let originalNodeEnv: string | undefined

      beforeEach(() => {
        originalNodeEnv = process.env.NODE_ENV
      })

      afterEach(() => {
        if (originalNodeEnv !== undefined) {
          process.env.NODE_ENV = originalNodeEnv
        } else {
          delete process.env.NODE_ENV
        }
      })

      it("sets secure cookie if X-Forwarded-Proto is https", (done) => {
        chai.request(new Server().app)
          .get("/actions/mock_oauth_action/oauth?state=my_state")
          .set("X-Forwarded-Proto", "https")
          .redirects(0)
          .end((_err, res) => {
            chai.expect(res).to.have.status(302)
            const cookies = res.header["set-cookie"][0]
            chai.expect(cookies).to.include("Secure")
            done()
          })
      })

      it("sets secure cookie if NODE_ENV is production", (done) => {
        process.env.NODE_ENV = "production"
        chai.request(new Server().app)
          .get("/actions/mock_oauth_action/oauth?state=my_state")
          .redirects(0)
          .end((_err, res) => {
            chai.expect(res).to.have.status(302)
            const cookies = res.header["set-cookie"][0]
            chai.expect(cookies).to.include("Secure")
            done()
          })
      })

      it("does not set secure cookie in development over HTTP", (done) => {
        delete process.env.NODE_ENV
        chai.request(new Server().app)
          .get("/actions/mock_oauth_action/oauth?state=my_state")
          .redirects(0)
          .end((_err, res) => {
            chai.expect(res).to.have.status(302)
            const cookies = res.header["set-cookie"][0]
            chai.expect(cookies).to.not.include("Secure")
            done()
          })
      })
    })
  })

})
