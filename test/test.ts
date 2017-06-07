import { expect } from "chai"

import * as D from "../src/framework"
import "../src/integrations/index"

D.allIntegrations().then((integrations) => {
  integrations.forEach((integration) => {

    describe(`${integration.name}`, () => {
      it("should provide the action function", async () => {
        expect(integration.action).to.be.a("function")
      })
    })

  })
})
