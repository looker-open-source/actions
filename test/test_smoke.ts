import * as chai from "chai"

import * as D from "../src/framework"

before(async () => {
  const allIntegrations = await D.allIntegrations()
  allIntegrations.forEach((integration) => {

    describe("Smoke Tests", () => {

      describe(integration.constructor.name, () => {

        it("should provide the action function", () => {
          chai.assert.typeOf(integration.action, "function")
        })

        it("should properly create json", () => {
          const json = integration.asJson({
            actionUrl(i) {
              return `baseurl/${i.name}`
            },
            formUrl(i) {
              return `baseurl/${i.name}`
            },
          })
          chai.assert.typeOf(json.url, "string")
        })

      })

    })

  })
})

it("This is a required placeholder to allow before() to work", () => {
  // noop
})
