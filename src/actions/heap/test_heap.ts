import * as chai from "chai"
import * as req from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../../src/hub"

import {
  HEAP_PROPERTY_TYPES,
  HeapAction,
  HeapField,
  HeapFields,
  HeapPropertyType,
} from "./heap"

const action = new HeapAction()

describe(`${action.constructor.name} unit tests`, () => {
  const ENV_ID = "1"
  const stubPost = sinon.stub(req, "post")
  HeapAction.HEAP_ENV_ID = "11"
  HeapAction.HEAP_IDENTITY = "example@example.com"

  beforeEach(() => {
    stubPost.reset()
    stubPost.returns({ promise: () => undefined })
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
    request.params = {}
    request.formParams = {
      heap_field: heapFieldLabel,
      property_type: propertyType,
      env_id: ENV_ID,
    }
    request.attachment = {
      dataBuffer: Buffer.from(
        JSON.stringify({ fields: { dimensions: fields }, data }),
      ),
    }
    return request
  }

  const expectAddUserPropertyRequest = (
    rows: {
      properties: { [K in string]: string | number };
      heapIdentity: string;
    }[],
    numCall = 0,
  ) => {
    chai.expect(stubPost.getCall(numCall).lastArg).to.deep.equal({
      uri: HeapAction.ADD_USER_PROPERTIES_URL,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: ENV_ID,
        library: "looker",
        users: rows.map(({ heapIdentity, properties }) => ({
          user_identifier: { email: heapIdentity },
          properties,
        })),
      }),
    })
  }

  const expectAddAccountPropertyRequest = (
    rows: {
      properties: { [K in string]: string | number };
      heapAccountId: string;
    }[],
    numCall = 0,
  ) => {
    chai.expect(stubPost.getCall(numCall).lastArg).to.deep.equal({
      uri: HeapAction.ADD_ACCOUNT_PROPERTIES_URL,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: ENV_ID,
        library: "looker",
        accounts: rows.map(({ heapAccountId, properties }) => ({
          account_id: heapAccountId,
          properties,
        })),
      }),
    })
  }

  const expectHeapTrackRequest = (
    heapField: HeapField,
    recordCount: number,
    state: "success" | "failure",
    numCall: number,
  ) => {
    const requestArg = stubPost.getCall(numCall).lastArg
    const requestBody = requestArg.body

    chai.expect(requestArg).to.deep.include({
      uri: HeapAction.HEAP_TRACK_URL,
      headers: { "Content-Type": "application/json" },
    })
    chai.expect(requestBody).to.not.be.undefined
    chai.expect(JSON.parse(requestBody)).to.deep.include({
      app_id: HeapAction.HEAP_ENV_ID,
      identity: HeapAction.HEAP_IDENTITY,
      event: HeapAction.HEAP_EVENT_NAME,
      properties: {
        customer_env_id: ENV_ID,
        record_count: recordCount,
        field_type: heapField,
        state,
      },
    })
  }

  describe("Common Validation", () => {
    it("should fail when env ID is missing", async () => {
      const fields = [{ name: "email", label: "Email" }]
      const data = [{ email: { value: "value1" } }]
      const request = buildRequest(
        HEAP_PROPERTY_TYPES.User,
        "Email",
        fields,
        data,
      )
      request.formParams.env_id = undefined

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(false)
      chai
        .expect(response.message)
        .to.contain("Heap environment ID is invalid")
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should fail when env ID is malformed", async () => {
      const fields = [{ name: "email", label: "Email" }]
      const data = [{ email: { value: "value1" } }]
      const request = buildRequest(
        HEAP_PROPERTY_TYPES.User,
        "Email",
        fields,
        data,
      )
      request.formParams.env_id = "abc"

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(false)
      chai
        .expect(response.message)
        .to.contain("Heap environment ID is invalid")
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should fail when Heap field column is not provided", async () => {
      const fields = [{ name: "email", label: "Email" }]
      const data = [{ email: { value: "value1" } }]
      const request = buildRequest(HEAP_PROPERTY_TYPES.User, "", fields, data)

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(false)
      chai
        .expect(response.message)
        .to.contain("Column mapping to a Heap field must be provided")
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should fail when provided unsupported property type", async () => {
      const fields = [{ name: "email", label: "Email" }]
      const data = [{ email: { value: "value1" } }]
      const request = buildRequest(
        "unsupported" as HeapPropertyType,
        "Email",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(false)
      chai.expect(response.message).to.contain("Unsupported property type")
      chai.expect(stubPost).to.have.not.been.called
    })

    it("should throw when Heap field is missing", async () => {
      const fields = [{ name: "name", label: "label" }]
      const data = [{ name: { value: "value1" } }]
      const request = buildRequest(
        HEAP_PROPERTY_TYPES.User,
        "Email",
        fields,
        data,
      )
      const response = await action.validateAndExecute(request)
      chai.expect(response.success).to.equal(false)
      chai.expect(response.message).to.contain("Heap field (Email) is missing in the query result.")
      chai.expect(stubPost).to.have.been.calledOnce
      expectHeapTrackRequest(HeapFields.Identity, 0, "failure", 0)
    })

    it("should skip rows with null heap field", async () => {
      const fields = [{ name: "email", label: "Email" }]
      const data = [{ email: { value: null } }]
      const request = buildRequest(
        HEAP_PROPERTY_TYPES.User,
        "Email",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledOnce
      expectHeapTrackRequest(HeapFields.Identity, 0, "success", 0)
    })
  })

  describe("Add User Properties", () => {
    it("should send a request for each row", async () => {
      const fields = [
        { name: "property1", label: "Property 1" },
        { name: "property2", label: "Property 2" },
        { name: "email", label: "Email" },
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
        HEAP_PROPERTY_TYPES.User,
        "Email",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledTwice
      expectAddUserPropertyRequest([
        {
          properties: {
            "Property 1": "value1A",
            "Property 2": "value2A",
          },
          heapIdentity: "testA@heap.io",
        },
        {
          properties: {
            "Property 1": "value1B",
            "Property 2": "value2B",
          },
          heapIdentity: "testB@heap.io",
        },
      ])
      expectHeapTrackRequest(HeapFields.Identity, 2, "success", 1)
    })
  })

  describe("Add Account Properties", () => {
    it("should send a request for each row", async () => {
      const fields = [
        { name: "property1", label: "Property 1" },
        { name: "property2", label: "Property 2" },
        { name: "account ID", label: "Account ID" },
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
        HEAP_PROPERTY_TYPES.Account,
        "Account ID",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledTwice
      expectAddAccountPropertyRequest([
        {
          properties: {
            "Property 1": "value1A",
            "Property 2": "value2A",
          },
          heapAccountId: "accountA",
        },
        {
          properties: {
            "Property 1": "value1B",
            "Property 2": "value2B",
          },
          heapAccountId: "accountB",
        },
      ])
      expectHeapTrackRequest(HeapFields.AccountId, 2, "success", 1)
    })
  })

  describe("Common Processing", () => {
    it("should stringify all property values", async () => {
      const fields = [
        { name: "property1", label: "Property 1", is_numeric: true },
        { name: "property2", label: "Property 2", is_numeric: false },
        { name: "account ID", label: "Account ID" },
      ]
      const data = [
        {
          "property1": { value: 1 },
          "property2": { value: "value2" },
          "account ID": { value: "account" },
        },
      ]

      const request = buildRequest(
        HEAP_PROPERTY_TYPES.Account,
        "Account ID",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      expectAddAccountPropertyRequest([
        {
          properties: {
            "Property 1": "1",
            "Property 2": "value2",
          },
          heapAccountId: "account",
        },
      ])
      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledTwice
    })

    it("should correctly batch rows", async () => {
      const requestCount = HeapAction.ROWS_PER_BATCH * 1.5
      const fields = [
        { name: "property", label: "Property" },
        { name: "account ID", label: "Account ID" },
      ]
      const data = [...Array(Math.floor(requestCount)).keys()].map((value) => ({
        "property": { value: value.toString() },
        "account ID": { value: value.toString() },
      }))

      const request = buildRequest(
        HEAP_PROPERTY_TYPES.Account,
        "Account ID",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      // two batched requests and then the Heap track call
      chai.expect(stubPost).to.have.been.callCount(3)

      expectAddAccountPropertyRequest(
        data.slice(0, HeapAction.ROWS_PER_BATCH).map((row) => ({
          properties: { Property: row.property.value },
          heapAccountId: row["account ID"].value,
        })),
        0,
      )
      expectAddAccountPropertyRequest(
        data.slice(HeapAction.ROWS_PER_BATCH).map((row) => ({
          properties: { Property: row.property.value },
          heapAccountId: row["account ID"].value,
        })),
        1,
      )
      expectHeapTrackRequest(HeapFields.AccountId, requestCount, "success", 2)
    })

    it("should catch rejected request promises", async () => {
      const fields = [
        { name: "property", label: "Property" },
        { name: "account ID", label: "Account ID" },
      ]
      const data = [
        {
          "property": { value: "value" },
          "account ID": { value: "account" },
        },
      ]
      const request = buildRequest(
        HEAP_PROPERTY_TYPES.Account,
        "Account ID",
        fields,
        data,
      )
      const requestError = "Error: Incorrect request body format"
      stubPost.reset()
      stubPost.returns({
        promise: async () => Promise.reject(new Error(requestError)),
      })

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(false)
      chai.expect(response.message).to.contain(requestError)
    })
  })
})
