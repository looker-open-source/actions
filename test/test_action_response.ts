import * as chai from "chai"

import type { Errors } from "../lib/hub/action_response"
import { ActionResponse} from "../src/hub"

describe("ActionResponse validation", () => {
  it("json must have a top level looker: key", (done) => {
    const response = new ActionResponse({success: false})
    const jsonResponse = response.asJson()
    chai.expect(jsonResponse.looker).to.not.be.null
    done()
  })

  it("must populate errors object if provided", () => {
    const errors: Errors = {
      http_code: 500,
      status_code: "TEST_FAIL",
      message: "testing failure message",
      location: "actions/test_action_response",
      documentation_url: "http://test/documentation",
    }
    const response = new ActionResponse({success: false, errors: [errors]})
    const jsonResponse = response.asJson()
    chai.expect(jsonResponse.looker.errors[0]).to.equal(errors)
  })

  it("must be a valid response if errors object is not provided", () => {
    const response = new ActionResponse({success: false})
    const jsonResponse = response.asJson()
    chai.expect(jsonResponse.looker).to.not.be.null
    chai.expect(jsonResponse.looker.errors).to.be.undefined
  })
})
