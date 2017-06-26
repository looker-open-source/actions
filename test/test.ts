import { assert } from "chai"

import "../src/integrations/index"

import * as D from "../src/framework"

before(async () => {
  const allIntegrations = await D.allIntegrations()
  allIntegrations.forEach((integration) => {

    describe(`${integration.name}`, () => {

      it("should provide the action function", () => {
        assert.typeOf(integration.action, "function")
      })

      it("should properly create json", () => {
        const json = integration.asJson()
        assert.typeOf(json.url, "string")
      })

    })

  })
})

it("This is a required placeholder to allow before() to work", () => {
  // noop
})
