import * as chai from "chai"

import { ActionResponse} from "../src/hub"

describe("ActionResponse validation", () => {
  it("json must have a top level looker: key", (done) => {
    const response = new ActionResponse({success: false})
    const jsonResponse = response.asJson()
    chai.expect(jsonResponse.looker).to.not.be.null
    done()
  })
})
