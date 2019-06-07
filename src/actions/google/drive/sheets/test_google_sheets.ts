import * as b64 from "base64-url"
import * as chai from "chai"
import * as sinon from "sinon"

import concatStream = require("concat-stream")

import * as Hub from "../../../../hub"

import { ActionCrypto } from "../../../../hub"
import { GoogleSheetsAction } from "./google_sheets"

const action = new GoogleSheetsAction()

const stubFileName = "stubSuggestedFilename"
const stubFolder = "stubSuggestedFolder"

function expectGoogleSheetsMatch(request: Hub.ActionRequest, paramsMatch: any) {

  const expectedBuffer = paramsMatch.media.body
  delete paramsMatch.media.body

  const createSpy = sinon.spy(async (params: any) => {
    params.media.body.pipe(concatStream((buffer) => {
      chai.expect(buffer.toString()).to.equal(expectedBuffer.toString())
    }))
    return { promise: async () => Promise.resolve() }
  })

  const stubClient = sinon.stub(action as any, "driveClientFromRequest")
    .resolves({
      files: {
        create: createSpy,
      },
    })

  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
    chai.expect(createSpy).to.have.been.called
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {
  let encryptStub: any
  let decryptStub: any

  beforeEach(() => {
    encryptStub = sinon.stub(ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    decryptStub = sinon.stub(ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
  })

  afterEach(() => {
    encryptStub.restore()
    decryptStub.restore()
  })

  describe("action", () => {

    it("successfully interprets execute request params", () => {
      const request = new Hub.ActionRequest()
      const dataBuffer = Buffer.from("Hello")
      request.type = Hub.ActionType.Query
      request.attachment = {dataBuffer, fileExtension: "csv"}
      request.formParams = {filename: stubFileName, folder: stubFolder}
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "access", redirect: "url"}),
      }
      return expectGoogleSheetsMatch(request, {
        requestBody: {
          name: stubFileName,
          mimeType: "application/vnd.google-apps.spreadsheet",
          parents: [stubFolder],
        },
        media: {
          body: dataBuffer,
        },
      })
    })

  })
})
