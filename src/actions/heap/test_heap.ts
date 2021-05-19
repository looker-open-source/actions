import * as chai from "chai"
import * as req from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../../src/hub"

import { HeapAction, HeapPropertyType, HeapPropertyTypes } from "./heap"

const action = new HeapAction()

describe(`${action.constructor.name} unit tests`, () => {
  const ENV_ID = "1"
  const stubPost = sinon.stub(req, "post")
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
    rows: {
      properties: { [K in string]: string | number };
      heapIdentity: string;
    }[],
  ) => {
    chai.expect(stubPost).to.have.been.calledWith({
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

    it("should skip rows with null heap field", async () => {
      const fields = [{ name: "email", label: "Email" }]
      const data = [{ email: { value: null } }]
      const request = buildRequest(
        HeapPropertyTypes.User,
        "Email",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.not.been.called
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
        HeapPropertyTypes.User,
        "Email",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledOnce
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
        HeapPropertyTypes.Account,
        "Account ID",
        fields,
        data,
      )

      const response = await action.validateAndExecute(request)

      chai.expect(response.success).to.equal(true)
      chai.expect(stubPost).to.have.been.calledOnce
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
    })
  })

  describe("Common Processing", () => {
    it("should send properties with correct types", async () => {
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
        HeapPropertyTypes.Account,
        "Account ID",
        fields,
        data,
      )

      await action.validateAndExecute(request)

      expectAddAccountPropertyRequest([
        {
          properties: {
            "Property 1": 1,
            "Property 2": "value2",
          },
          heapAccountId: "account",
        },
      ])
    })

    it("should corectly batch rows", async () => {
      const fields = [
        { name: "property", label: "Property" },
        { name: "account ID", label: "Account ID" },
      ]
      const data = [
        ...Array(Math.floor(HeapAction.ROWS_PER_BATCH * 1.5)).keys(),
      ].map((value) => ({
        "property": { value: value.toString() },
        "account ID": { value: value.toString() },
      }))

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
    })
  })
})
