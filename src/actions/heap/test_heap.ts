import * as chai from "chai"
import * as req from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../../src/hub"

import {
  HeapAction,
  HeapPropertyType,
  HeapPropertyTypes,
} from "./heap"

const action = new HeapAction()

describe(`${action.constructor.name} unit tests`, () => {
  const ENV_ID = "1"
  const stubPost = sinon.stub(req, "post").returns(undefined)
  beforeEach(() => {
    stubPost.reset()
    stubPost.returns(null)
  })
  after(stubPost.restore)

  const buildRequest = (
    propertyType: HeapPropertyType,
    heapFieldLabel: string,
    fields: { name: string; label: string }[],
    data: { [K in string]: { value: any } }[],
  ): Hub.ActionRequest => {
    const request = new Hub.ActionRequest()
    request.type = Hub.ActionType.Query
    request.params = { heap_env_id: ENV_ID }
    request.formParams = {
      heap_field: heapFieldLabel,
      property_type: propertyType,
    }
    request.attachment = {
      dataBuffer: Buffer.from(
        JSON.stringify({ fields: { dimensions: fields }, data }),
      ),
    }
    return request
  }

  const expectAddUserPropertyRequest = (
    properties: { [K in string]: string | number },
    heapIdentity: string,
  ) => {
    chai.expect(stubPost).to.have.been.calledWith({
      uri: HeapAction.ADD_USER_PROPERTIES_URL,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: ENV_ID,
        library: "looker",
        users: [
          {
            user_identifier: { email: heapIdentity },
            properties,
          },
        ],
      }),
    })
  }

  const expectAddAccountPropertyRequest = (
    properties: { [K in string]: string | number },
    heapAccountId: string,
  ) => {
    chai.expect(stubPost).to.have.been.calledWith({
      uri: HeapAction.ADD_ACCOUNT_PROPERTIES_URL,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: ENV_ID,
        library: "looker",
        accounts: [
          {
            account_id: heapAccountId,
            properties,
          },
        ],
      }),
    })
  }

  describe("Common Validation", () => {
    it("should throw when env ID is missing", async () => {
      const fields = [{ name: "email", label: "email" }]
      const data = [{ email: { value: "value1" } }]
      const request = buildRequest(
        HeapPropertyTypes.User,
        "Email",
        fields,
        data,
      )
      request.params = {}

      chai.expect(action.validateAndExecute(request)).to.be.eventually.rejected
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should throw when Heap field column is not provided", async () => {
      const fields = [{ name: "email", label: "Email" }]
      const data = [{ email: { value: "value1" } }]
      const request = buildRequest(HeapPropertyTypes.User, "", fields, data)

      chai
        .expect(action.validateAndExecute(request))
        .to.be.eventually.rejectedWith(
          new RegExp("Column mapping to a Heap field must be provided"),
        )
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should throw when provided unsupported property type", async () => {
      const fields = [{ name: "email", label: "Email" }]
      const data = [{ email: { value: "value1" } }]
      const request = buildRequest(
        "unsupported" as HeapPropertyType,
        "Email",
        fields,
        data,
      )

      chai
        .expect(action.validateAndExecute(request))
        .to.be.eventually.rejectedWith(new RegExp("Unsupported property type"))
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should throw when Heap field is missing", async () => {
      const fields = [{ name: "name", label: "label" }]
      const data = [{ name: { value: "value1" } }]
      const request = buildRequest(
        HeapPropertyTypes.User,
        "Email",
        fields,
        data,
      )

      chai
        .expect(action.validateAndExecute(request))
        .to.be.eventually.rejectedWith(
          "Heap field (Email) is missing in the query result.",
        )
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should fail when Heap field is empty in a row", async () => {
      const fields = [{ name: "email", label: "Email" }]
      const data = [{ email: { value: "" } }]
      const request = buildRequest(
        HeapPropertyTypes.User,
        "Email",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(false)
      chai
        .expect(response.message)
        .to.match(new RegExp("Found a row with an empty Email field"))
      chai.expect(stubPost).to.have.not.been.called
    })
  })

  describe("Add User Properties", () => {
    it("should send a request for each row", async () => {
      const fields = [
        { name: "property1", label: "Property 1" },
        { name: "property2", label: "Property 2" },
        { name: "email", tags: ["identity"], label: "Email" },
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
      const request = buildRequest(
        HeapPropertyTypes.User,
        "Email",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledTwice
      expectAddUserPropertyRequest(
        {
          "Looker Property 1": "value1A",
          "Looker Property 2": "value2A",
        },
        "testA@heap.io",
      )
      expectAddUserPropertyRequest(
        {
          "Looker Property 1": "value1B",
          "Looker Property 2": "value2B",
        },
        "testB@heap.io",
      )
    })
  })

  describe("Add Account Properties", () => {
    it("should send a request for each row", async () => {
      const fields = [
        { name: "property1", label: "Property 1" },
        { name: "property2", label: "Property 2" },
        { name: "account ID", tags: ["account_id"], label: "Account ID" },
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
      const request = buildRequest(
        HeapPropertyTypes.Account,
        "Account ID",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledTwice
      expectAddAccountPropertyRequest(
        {
          "Looker Property 1": "value1A",
          "Looker Property 2": "value2A",
        },
        "accountA",
      )
      expectAddAccountPropertyRequest(
        {
          "Looker Property 1": "value1B",
          "Looker Property 2": "value2B",
        },
        "accountB",
      )
    })
  })

  describe("Common Processing", () => {
    it("should send properties with correct types", async () => {
      const fields = [
        { name: "property1", label: "Property 1", is_numeric: true },
        { name: "property2", label: "Property 2", is_numeric: false },
        { name: "account ID", tags: ["account_id"], label: "Account ID" },
      ]
      const data = [
        {
          "property1": { value: 1 },
          "property2": { value: "value2" },
          "account ID": { value: "account" },
        },
      ]
      const request = buildRequest(
        HeapPropertyTypes.Account,
        "Account ID",
        fields,
        data,
      )

      await action.validateAndExecute(request)

      expectAddAccountPropertyRequest(
        {
          "Looker Property 1": 1,
          "Looker Property 2": "value2",
        },
        "account",
      )
    })
  })
})
