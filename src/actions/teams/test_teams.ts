import * as chai from "chai"
import * as httpRequest from "request-promise-native"
import * as sinon from "sinon"
import { Query } from "../../api_types/query"

import * as Hub from "../../hub"
import { TeamsAction } from "./teams"

const action = new TeamsAction()

describe(`${action.constructor.name} unit tests`, () => {
  describe("action fail case", () => {
    it("Fail: missing formparams webhookurl", async () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        title: "testtitle",
        isAttached: "true",
      }
      request.scheduledPlan = {
        url: "https://testurl.com/downlaoad",
        query: {
          model: "test",
          view: "test",
        } as Query,
      }

      chai
        .expect(action.execute(request))
        .to.eventually.be.rejectedWith("Need a webhookUrl")
    })

    it("Fail: missing formparams title", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.formParams = {
        webhookUrl: "testwebhookUrl",
        isAttached: "true",
      }
      request.scheduledPlan = {
        url: "https://testurl.com/downlaoad",
        query: {
          model: "test",
          view: "test",
        } as Query,
      }

      chai
        .expect(action.execute(request))
        .to.eventually.be.rejectedWith("Need a title")
    })

    it("Fail: missing formparams isAttached", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.formParams = {
        title: "testtitle",
        webhookUrl: "testwebhookUrl",
      }
      request.scheduledPlan = {
        url: "https://testurl.com/downlaoad",
        query: {
          model: "test",
          view: "test",
        } as Query,
      }

      chai
        .expect(action.execute(request))
        .to.eventually.be.rejectedWith("Need a attach flag")
    })

    it("Fail: missing scheduledPlan", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.formParams = {
        webhookUrl: "testwebhookUrl",
        title: "testtitle",
        isAttached: "true",
      }

      chai
        .expect(action.execute(request))
        .to.eventually.be.rejectedWith("Couldn't get data from scheduledPlan")
    })

    it("Fail: cause of httpRequest", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.formParams = {
        webhookUrl: "testwebhookUrl",
        title: "testtitle",
        isAttached: "true",
      }
      request.scheduledPlan = {
        url: "https://testurl.com/downlaoad",
        query: {
          model: "test",
          view: "test",
        } as Query,
      }
      const postSpy = sinon.spy((params: any) => {
        chai.expect(params.url).to.equal("testwebhookUrl")
        chai.expect(params.json.title).to.equal("testtitle")
        chai
          .expect(params.json.potentialAction[0].targets[0].uri)
          .to.equal("https://testurl.com/downlaoad")
        return {
          promise: async () =>
            new Promise<void>((rejects: any) => rejects("error")),
        }
      })

      const stubHttpPost = sinon.stub(httpRequest, "post").callsFake(postSpy)

      const resp = await action.execute(request)
      chai.expect(resp).to.be.deep.equal({
        success: false,
        message: "error",
        refreshQuery: false,
        validationErrors: [],
      })
      stubHttpPost.restore()
    })

    it("Fail: cause of teams request", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.type = Hub.ActionType.Query
      request.formParams = {
        webhookUrl: "testwebhookUrl",
        title: "testtitle",
        isAttached: "true",
      }
      request.scheduledPlan = {
        url: "https://testurl.com/downlaoad",
        query: {
          model: "test",
          view: "test",
        } as Query,
      }

      const postSpy = sinon.spy((params: any) => {
        chai.expect(params.url).to.equal("testwebhookUrl")
        chai.expect(params.json.title).to.equal("testtitle")
        chai
          .expect(params.json.potentialAction[0].targets[0].uri)
          .to.equal("https://testurl.com/downlaoad")
        return {
          promise: async () =>
            new Promise<void>((resolve: any) => resolve("error")),
        }
      })

      const stubHttpPost = sinon.stub(httpRequest, "post").callsFake(postSpy)

      const resp = await action.execute(request)
      chai.expect(resp).to.be.deep.equal({
        success: false,
        message: "error",
        refreshQuery: false,
        validationErrors: [],
      })
      stubHttpPost.restore()
    })

    it("Success : Query", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.formParams = {
        webhookUrl: "testwebhookUrl",
        title: "testtitle",
        isAttached: "true",
      }
      request.scheduledPlan = {
        title: "testtitle",
        url: "https://testurl.com/downlaoad",
        query: {
          model: "test",
          view: "test",
        } as Query,
      }

      const postSpy = sinon.spy((params: any) => {
        chai.expect(params.url).to.equal("testwebhookUrl")
        chai.expect(params.json.title).to.equal("testtitle")
        chai
          .expect(params.json.potentialAction[0].targets[0].uri)
          .to.equal("https://testurl.com/downlaoad")
        return {
          promise: async () => new Promise<void>((resolve: any) => resolve(1)),
        }
      })
      const stubHttpPost = sinon.stub(httpRequest, "post").callsFake(postSpy)

      const resp = await action.execute(request)
      chai.expect(resp).to.be.deep.equal({
        success: true,
        message: "success",
        refreshQuery: false,
        validationErrors: [],
      })
      chai.expect(postSpy).to.have.been.called
      stubHttpPost.restore()
    })

    it("Success : Dashboard", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.formParams = {
        webhookUrl: "testwebhookUrl",
        title: "testtitle",
        isAttached: "true",
      }
      request.scheduledPlan = {
        title: "testtitle",
        url: "https://testurl.com/downlaoad",
      }

      const postSpy = sinon.spy((params: any) => {
        chai.expect(params.url).to.equal("testwebhookUrl")
        chai.expect(params.json.title).to.equal("testtitle")
        chai
          .expect(params.json.potentialAction[0].targets[0].uri)
          .to.equal("https://testurl.com/downlaoad")
        return {
          promise: async () => new Promise<void>((resolve: any) => resolve(1)),
        }
      })
      const stubHttpPost = sinon.stub(httpRequest, "post").callsFake(postSpy)

      const resp = await action.execute(request)
      chai.expect(resp).to.be.deep.equal({
        success: true,
        message: "success",
        refreshQuery: false,
        validationErrors: [],
      })
      chai.expect(postSpy).to.have.been.called
      stubHttpPost.restore()
    })
  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })
})
