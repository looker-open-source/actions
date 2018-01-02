import * as chai from "chai"

import * as Hub from "../src/hub"

before(async () => {
  const allActions = await Hub.allActions()
  allActions.forEach((action) => {

    describe("Smoke Tests", () => {

      describe(action.constructor.name, () => {

        it("should provide the action function", () => {
          chai.assert.typeOf(action.execute, "function")
        })

        it("should properly create json", () => {
          const json = action.asJson({
            actionUrl(i) {
              return `baseurl/${i.name}`
            },
            formUrl(i) {
              return `baseurl/${i.name}`
            },
          })
          chai.assert.typeOf(json.url, "string")
        })

        it("should provide supported_action_types", () => {
          chai.assert.typeOf(action.supportedActionTypes, "array")
          chai.assert.isNotEmpty(action.supportedActionTypes, "each action should support at least one action type")
        })

      })

    })

  })
})

it("This is a required placeholder to allow before() to work", () => {
  // noop
})
