import * as chai from "chai"
import {HTTP_ERROR} from "./http_errors"
import {getHttpErrorType} from "./utils"

describe("Http Error util tests", () => {
  it("returns server error if input is bad",  () => {
    const error = { undefined }
    chai.expect(getHttpErrorType(error, "test_action")).to.deep.equal({
        status: HTTP_ERROR.internal.status,
        code: HTTP_ERROR.internal.code,
        description: `${HTTP_ERROR.internal.description}`,
    })
  })
  it("formats error correctly if input is a number casted as a string", () => {
    const error = { code: "401" }
    chai.expect(getHttpErrorType(error, "test_action")).to.deep.equal({
        status: HTTP_ERROR.unauthenticated.status,
        code: HTTP_ERROR.unauthenticated.code,
        description: HTTP_ERROR.unauthenticated.description,
    })
  })
  it("formats error correctly if input is number that we have defined", () => {
    const error = { code: 401 }
    chai.expect(getHttpErrorType(error, "test_action")).to.deep.equal({
      status: HTTP_ERROR.unauthenticated.status,
      code: HTTP_ERROR.unauthenticated.code,
      description: HTTP_ERROR.unauthenticated.description,
    })
  })
  it("formats error correctly if input is number that we don't have defined", () => {
    const error = { code: 300 }
    chai.expect(getHttpErrorType(error, "test_action")).to.deep.equal({
        status: HTTP_ERROR.internal.status,
        code: 300,
        description: `${HTTP_ERROR.internal.description}`,
    })
  })
  it("formats error correctly if input is string that we have defined", () => {
    const error = { code: "BAD_REQUEST" }
    chai.expect(getHttpErrorType(error, "test_action")).to.deep.equal({
        status: HTTP_ERROR.bad_request.status,
        code: HTTP_ERROR.bad_request.code,
        description: HTTP_ERROR.bad_request.description,
    })
  })
  it("formats error correctly if input is string we don't have defined", () => {
    const error = { code: "ERR_CONNECT_TIMEOUT" }
    chai.expect(getHttpErrorType(error, "test_action")).to.deep.equal({
        status: "ERR_CONNECT_TIMEOUT",
        code: HTTP_ERROR.internal.code,
        description: `${HTTP_ERROR.internal.description}`,
    })
  })
  it("returns 500 if e.code does not exist", () => {
    const error = { }
    chai.expect(getHttpErrorType(error, "test_action")).to.deep.equal({
      status: HTTP_ERROR.internal.status,
      code: HTTP_ERROR.internal.code,
      description: `${HTTP_ERROR.internal.description}`,
    })
  })
})

describe("Google error types", () => {
  it("returns 500 if no strings match", () => {
    const error = { message: "no match" }
    chai.expect(getHttpErrorType(error, "google_testing_test")).to.deep.equal({
        status: HTTP_ERROR.internal.status,
        code: HTTP_ERROR.internal.code,
        description: HTTP_ERROR.internal.description,
    })
  })
  it("matches if message is in e.errors[0].message", () => {
    const error = {errors: [{message: "invalid_grant"}]}
    chai.expect(getHttpErrorType(error, "google_testing_test")).to.deep.equal({
        status: HTTP_ERROR.unauthenticated.status,
        code: HTTP_ERROR.unauthenticated.code,
        description: HTTP_ERROR.unauthenticated.description,
    })
  })
  it("matches if message is in e.toString()", () => {
    const error = ["invalid opening quote"]
    chai.expect(getHttpErrorType(error, "google_testing_test")).to.deep.equal({
        status: HTTP_ERROR.bad_request.status,
        code: HTTP_ERROR.bad_request.code,
        description: HTTP_ERROR.bad_request.description,
    })
  })
  it("matches if message is in e.message()", () => {
    const error = { message: "file not found" }
    chai.expect(getHttpErrorType(error, "google_testing_test")).to.deep.equal({
        status: HTTP_ERROR.not_found.status,
        code: HTTP_ERROR.not_found.code,
        description: HTTP_ERROR.not_found.description,
    })
  })
  it("returns correct http_error if it does not match googleErrorMessage", () => {
    const error = { message: "no match", code: "BAD_REQUEST" }
    chai.expect(getHttpErrorType(error, "google_testing_test")).to.deep.equal({
        status: HTTP_ERROR.bad_request.status,
        code: HTTP_ERROR.bad_request.code,
        description: HTTP_ERROR.bad_request.description,
    })
  })
  it("returns google http_error if matches googleErrorMessage and matches default error code", () => {
    const error = { message: "invalid_grant", code: "BAD_REQUEST" }
    chai.expect(getHttpErrorType(error, "google_testing_test")).to.deep.equal({
        status: HTTP_ERROR.unauthenticated.status,
        code: HTTP_ERROR.unauthenticated.code,
        description: HTTP_ERROR.unauthenticated.description,
    })
  })
})
