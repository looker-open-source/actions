import * as chai from "chai"
import * as req from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../../src/hub"

import { HeapAction, HeapTag, HeapTags } from "./heap"

const action = new HeapAction()

describe(`${action.constructor.name} unit tests`, () => {
  const APP_ID = "1"
  const stubPost = sinon.stub(req, "post").returns(undefined)
  beforeEach(() => {
    stubPost.reset()
    stubPost.returns(null)
  })
  after(stubPost.restore)

  const buildRequest = (
    fields: { name: string }[],
    data: { [K in string]: { value: string } }[],
  ): Hub.ActionRequest => {
    const request = new Hub.ActionRequest()
    request.type = Hub.ActionType.Query
    request.params = { heap_app_id: APP_ID }
    request.attachment = {
      dataBuffer: Buffer.from(
        JSON.stringify({ fields: { dimensions: fields }, data }),
      ),
    }
    return request
  }

  const expectRequestSent = (
    url: string,
    properties: { [K in string]: string },
    heapTag: HeapTag,
    heapTagValue: string,
  ) => {
    chai.expect(stubPost).to.have.been.calledWith({
      uri: url,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: APP_ID,
        [heapTag]: heapTagValue,
        properties,
      }),
    })
  }

  describe("Common Validation", () => {
    it("should throw when app ID is missing", async () => {
      const fields = [{ name: "property1" }]
      const data = [{ property1: { value: "value1" } }]
      const request = buildRequest(fields, data)
      request.params = {}

      chai.expect(action.validateAndExecute(request)).to.be.eventually.rejected
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should fail when Heap tag is missing", async () => {
      const fields = [{ name: "property1" }]
      const data = [{ property1: { value: "value1" } }]
      const request = buildRequest(fields, data)

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(false)
      chai
        .expect(response.message)
        .to.match(new RegExp("Did not find one of the required tags"))
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should fail when more one fields are tagged with a Heap tag", async () => {
      const fields = [
        { name: "property1", tags: ["identity"] },
        { name: "property2", tags: ["identity"] },
      ]
      const data = [
        { property1: { value: "value1" }, property2: { value: "value2" } },
      ]
      const request = buildRequest(fields, data)

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(false)
      chai
        .expect(response.message)
        .to.match(
          new RegExp("Found multiple columns tagged with one of the Heap tags"),
        )
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should fail when a field is tagged with more than one Heap tag", async () => {
      const fields = [{ name: "property1", tags: ["identity", "account_id"] }]
      const data = [{ property1: { value: "value1" } }]
      const request = buildRequest(fields, data)

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(false)
      chai
        .expect(response.message)
        .to.match(new RegExp("Found a field tagged with multiple Heap tags"))
      chai.expect(stubPost).to.have.not.been.called
    })
  })

  describe("Add User Properties", () => {
    it("should send a request for each row", async () => {
      const fields = [
        { name: "property1" },
        { name: "property2" },
        { name: "email", tags: ["identity"] },
      ]
      const data = [
        {
          property1: { value: "value1A" },
          property2: { value: "value2A" },
          email: { value: "testA@heap.io" },
        },
        {
          property1: { value: "value1B" },
          property2: { value: "value2B" },
          email: { value: "testB@heap.io" },
        },
      ]
      const request = buildRequest(fields, data)

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledTwice
      expectRequestSent(
        HeapAction.ADD_USER_PROPERTIES_URL,
        {
          "Looker property1": "value1A",
          "Looker property2": "value2A",
        },
        HeapTags.Identity,
        "testA@heap.io",
      )
      expectRequestSent(
        HeapAction.ADD_USER_PROPERTIES_URL,
        {
          "Looker property1": "value1B",
          "Looker property2": "value2B",
        },
        HeapTags.Identity,
        "testB@heap.io",
      )
    })
  })

  describe("Add Account Properties", () => {
    it("should send a request for each row", async () => {
      const fields = [
        { name: "property1" },
        { name: "property2" },
        { name: "account ID", tags: ["account_id"] },
      ]
      const data = [
        {
          "property1": { value: "value1A" },
          "property2": { value: "value2A" },
          "account ID": { value: "accountA" },
        },
        {
          "property1": { value: "value1B" },
          "property2": { value: "value2B" },
          "account ID": { value: "accountB" },
        },
      ]
      const request = buildRequest(fields, data)

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledTwice
      expectRequestSent(
        HeapAction.ADD_ACCOUNT_PROPERTIES_URL,
        {
          "Looker property1": "value1A",
          "Looker property2": "value2A",
        },
        HeapTags.AccountId,
        "accountA",
      )
      expectRequestSent(
        HeapAction.ADD_ACCOUNT_PROPERTIES_URL,
        {
          "Looker property1": "value1B",
          "Looker property2": "value2B",
        },
        HeapTags.AccountId,
        "accountB",
      )
    })
  })
})
