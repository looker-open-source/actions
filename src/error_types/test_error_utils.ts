import * as chai from "chai"
import {HTTP_ERROR} from "./http_errors"
import {getHttpErrorType} from "./utils"

describe("Http Error util tests", () => {
  it("returns server error if input is bad",  () => {
    const error = undefined
    chai.expect(getHttpErrorType(error)).to.deep.equal({
        status: HTTP_ERROR.internal.status,
        code: HTTP_ERROR.internal.code,
        description: `${HTTP_ERROR.internal.description}`,
    })
  })
  it("formats error correctly if input is a number casted as a string", () => {
    const error = "401"
    chai.expect(getHttpErrorType(error)).to.deep.equal({
        status: HTTP_ERROR.unauthenticated.status,
        code: HTTP_ERROR.unauthenticated.code,
        description: HTTP_ERROR.unauthenticated.description,
    })
  })
  it("formats error correctly if input is number that we have defined", () => {
    const error = 401
    chai.expect(getHttpErrorType(error)).to.deep.equal({
      status: HTTP_ERROR.unauthenticated.status,
      code: HTTP_ERROR.unauthenticated.code,
      description: HTTP_ERROR.unauthenticated.description,
    })
  })
  it("formats error correctly if input is number that we don't have defined", () => {
    const error = 300
    chai.expect(getHttpErrorType(error)).to.deep.equal({
        status: HTTP_ERROR.internal.status,
        code: 300,
        description: `${HTTP_ERROR.internal.description}`,
    })
  })
  it("formats error correctly if input is string that we have defined", () => {
    const error = "BAD_REQUEST"
    chai.expect(getHttpErrorType(error)).to.deep.equal({
        status: HTTP_ERROR.bad_request.status,
        code: HTTP_ERROR.bad_request.code,
        description: HTTP_ERROR.bad_request.description,
    })
  })
  it("formats error correctly if input is string we don't have defined", () => {
    const error = "ERR_CONNECT_TIMEOUT"
    chai.expect(getHttpErrorType(error)).to.deep.equal({
        status: "ERR_CONNECT_TIMEOUT",
        code: HTTP_ERROR.internal.code,
        description: `${HTTP_ERROR.internal.description}`,
    })
  })
})
