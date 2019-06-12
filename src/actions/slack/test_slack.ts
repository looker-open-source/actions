import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { SlackAttachmentAction } from "./slack"

import { FilesUploadArguments } from "@slack/client";

const action = new SlackAttachmentAction()

const stubFileName = "stubSuggestedFilename"

function expectSlackMatch(request: Hub.ActionRequest, optionsMatch: FilesUploadArguments) {

  const fileUploadSpy = sinon.spy(async () => Promise.resolve())

  const stubClient = sinon.stub(action as any, "slackClientFromRequest")
    .callsFake(() => ({
      files: {
        upload: fileUploadSpy,
      },
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => stubFileName)

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(fileUploadSpy).to.have.been.calledWithMatch(optionsMatch)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no channel", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {}
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing channel.")
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        channel: "mychannel",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends to right body, channel and filename if specified", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        channel: "mychannel",
        filename: "mywackyfilename",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }
      return expectSlackMatch(request, {
        file: request.attachment.dataBuffer,
        filename: request.formParams.filename,
        channels: request.formParams.channel,
        filetype: request.attachment.fileExtension,
        initial_comment: request.formParams.initial_comment,
      })
    })

    it("sends right body and channel", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        channel: "mychannel",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }
      return expectSlackMatch(request, {
        file: request.attachment.dataBuffer,
        filename: stubFileName,
        channels: request.formParams.channel,
        filetype: request.attachment.fileExtension,
        initial_comment: request.formParams.initial_comment,
      })
    })

    it("returns failure on slack files.upload error", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        channel: "mychannel",
        initial_comment: "mycomment",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }

      const fileUploadSpy = sinon.spy(async () => Promise.reject({
        type: "CHANNEL_NOT_FOUND",
        message: "Could not find channel mychannel",
      }))

      const stubClient = sinon.stub(action as any, "slackClientFromRequest")
        .callsFake(() => ({
          files: {
            upload: fileUploadSpy,
          },
        }))

      return chai.expect(action.execute(request)).to.eventually.deep.equal({
        success: false,
        message: "Could not find channel mychannel",
        refreshQuery: false,
        validationErrors: [],
      }).then(() => {
        stubClient.restore()
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with correct channels", (done) => {
      const stubClient = sinon.stub(action as any, "slackClientFromRequest")
        .callsFake(() => ({
          channels: {
            list: (filters: any) => {
              if (filters.cursor) {
                return {
                  ok: true,
                  channels: [
                    {id: "3", name: "C", is_member: true},
                    {id: "4", name: "D", is_member: true},
                  ],
                }
              } else {
                return {
                  ok: true,
                  channels: [
                    {id: "1", name: "A", is_member: true},
                    {id: "2", name: "B", is_member: true},
                  ],
                  response_metadata: {
                    next_cursor: "cursor",
                  },
                }
              }
            },
          },
          users: {
            list: (filters: any) => {
              if (filters.cursor) {
                return {
                  ok: true,
                  members: [
                    {id: "30", name: "W"},
                    {id: "40", name: "X"},
                  ],
                }
              } else {
                return {
                  ok: true,
                    members: [
                      {id: "10", name: "Z"},
                      {id: "20", name: "Y"},
                    ],
                  response_metadata: {
                    next_cursor: "cursor",
                  },
                }
              }
            },
          },
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        slack_api_token: "foo",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          description: "Name of the Slack channel you would like to post to.",
          label: "Share In",
          name: "channel",
          options: [
            {name: "1", label: "#A"},
            {name: "2", label: "#B"},
            {name: "3", label: "#C"},
            {name: "4", label: "#D"},
            {name: "30", label: "@W"},
            {name: "40", label: "@X"},
            {name: "20", label: "@Y"},
            {name: "10", label: "@Z"}],
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
      }).and.notify(stubClient.restore).and.notify(done)
    })

  })

})
