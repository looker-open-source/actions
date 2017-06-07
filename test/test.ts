import { expect } from "chai"

import "../src/integrations/index"

import * as D from "../src/framework"

D.allIntegrations().then((integrations) => {
  integrations.forEach((integration) => {

    describe(`${integration.name}`, () => {
      it("should provide the action function", async () => {
        expect(integration.action).to.be.a("function")
      })
    })

  })
})
