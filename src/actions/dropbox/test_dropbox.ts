import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import * as helpers from "@sendgrid/helpers"

import { DropboxAction } from "./dropbox"

const action = new DropboxAction()

const stubFilename = "stubSuggestedFilename"
const stubDirectory = "stubSuggestedDirectory"

describe(`${action.constructor.name} unit tests`, () => {
  describe("action", () => {
    let stubHttpPost: sinon.SinonStub

    afterEach(() => {
      stubHttpPost.restore()
    })

    it("sends", () => {

    })
  })
})