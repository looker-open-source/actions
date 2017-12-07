import * as chai from "chai"
import * as sinon from "sinon"

import * as apiKey from "../src/server/api_key"
import Server from "../src/server/server"

describe("the action hub", () => {

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

  it("returns a list of integrations on POST to the root url with the proper authentication key", (done) => {
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

})
