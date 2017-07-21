import * as chai from "chai"

import * as D from "../src/framework"

before(async () => {
  const allIntegrations = await D.allIntegrations()
  allIntegrations.forEach((integration) => {

    describe(`${integration.name} smoke tests`, () => {

      it("should provide the action function", () => {
        chai.assert.typeOf(integration.action, "function")
      })

      it("should properly create json", () => {
        const json = integration.asJson()
        chai.assert.typeOf(json.url, "string")
      })

    })

  })
})

it("This is a required placeholder to allow before() to work", () => {
  // noop
})
