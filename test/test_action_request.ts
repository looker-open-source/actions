import * as chai from "chai"
import * as semver from "semver"
import {mockReq} from "sinon-express-mock"

import { ActionRequest } from "../src/hub"

describe("ActionRequest", () => {
  it("fromRequest", () => {

    const req = mockReq({
      headers: {
        "user-agent": "LookerOutgoingWebhook/7.3.0",
        "x-looker-webhook-id": "123",
        "x-looker-instance": "instanceId1",
      },
    })

    // @ts-ignore
    req.header = (name: string): string | string[] | undefined => req.headers[name]

    const result = ActionRequest.fromRequest(req)
    chai.expect(result.webhookId).to.equal("123")
    chai.expect(result.instanceId).to.equal("instanceId1")
    chai.expect(result.lookerVersion).to.equal(semver.valid("7.3.0"))
    chai.expect(result.lookerVersion).to.not.be.null
  })

  it("fromRequest doesn't skip ", () => {

    const req = mockReq({
      headers: {
        // our internal version scheme including trailing 0s
        "user-agent": "LookerOutgoingWebhook/7.3.00004561",
        "x-looker-webhook-id": "123",
        "x-looker-instance": "instanceId1",
      },
    })

    // @ts-ignore
    req.header = (name: string): string | string[] | undefined => req.headers[name]

    const result = ActionRequest.fromRequest(req)
    chai.expect(result.webhookId).to.equal("123")
    chai.expect(result.instanceId).to.equal("instanceId1")
    chai.expect(result.lookerVersion).to.not.be.null
    chai.expect(result.lookerVersion).to.equal(semver.valid("7.3.4561"))
  })

})
