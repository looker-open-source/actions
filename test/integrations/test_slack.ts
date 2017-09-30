import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { SlackIntegration } from "../../src/integrations/slack"

const integration = new SlackIntegration()

const stubFileName = "stubSuggestedFilename"

function expectSlackMatch(request: D.DataActionRequest, fileNameMatch: string, optionsMatch: any) {

  const fileUploadSpy = sinon.spy((filename: string, params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully sent ${filename} ${params}`)
  })

  const stubClient = sinon.stub(integration as any, "slackClientFromRequest")
    .callsFake(() => ({
      files: {
        upload: fileUploadSpy,
      },
      channels: {
        list: (filters: any, callback: (err: any, response: any) => void) => {
          callback(null, {
            ok: true,
            channels: [
              {id: "1", name: "A", is_member: true},
              {id: "2", name: "B", is_member: true},
            ],
            filters,
          })
        },
      },
      users: {
        list: (filters: any, callback: (err: any, response: any) => void) => {
          callback(null, {
            ok: true,
            channels: [
              {id: "10", name: "Z"},
              {id: "20", name: "Y"},
            ],
            filters,
          })
        },
      },
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => stubFileName)

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(fileUploadSpy).to.have.been.calledWithMatch(fileNameMatch, optionsMatch)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no channel", () => {
      const request = new D.DataActionRequest()
      request.formParams = {}
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }
      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Missing channel.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        channel: "mychannel",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends to right body, channel and filename if specified", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        channel: "mychannel",
        filename: "mywackyfilename",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }
      return expectSlackMatch(request, request.formParams.filename, {
        file: {
          value: request.attachment.dataBuffer,
          options: {
            filename: request.formParams.filename,
          },
        },
        channels: request.formParams.channel,
        filetype: request.attachment.fileExtension,
        initial_comment: request.formParams.initial_comment,
      })
    })

    it("sends right body and channel", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        channel: "mychannel",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }
      return expectSlackMatch(request, stubFileName, {
        file: {
          value: request.attachment.dataBuffer,
          options: {
            filename: stubFileName,
          },
        },
        channels: request.formParams.channel,
        filetype: request.attachment.fileExtension,
        initial_comment: request.formParams.initial_comment,
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with correct channels", () => {
      const request = new D.DataActionRequest()
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.equal({
        fields: [{
          description: "Name of the Slack channel you would like to post to.",
          label: "Share In",
          name: "channel",
          options: [
            {id: "1", label: "A"},
            {id: "2", label: "B"},
            {id: "10", label: "Z"},
            {id: "20", label: "Y"}],
          required: true,
          type: "select",
        }, {
          label: "Comment",
          type: "string",
          name: "initial_comment",
        }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }],
      })
    })

  })

})
