import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { SlackAttachmentAction } from "./slack"

const action = new SlackAttachmentAction()

const stubFileName = "stubSuggestedFilename"

function expectSlackMatch(request: Hub.ActionRequest, optionsMatch: any) {

  const fileUploadSpy = sinon.spy((filename: string, params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully sent ${filename} ${params}`)
  })

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

      const fileUploadSpy = sinon.spy((_params: any, callback: (err: any) => void) => {
        callback({
          type: "CHANNEL_NOT_FOUND",
          message: "Could not find channel mychannel",
        })
      })

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
          conversations: {
            list: (filters: any) => {
              if (filters.cursor) {
                return {
                  ok: true,
                  channels: [
                    {
                      id: "D0C0F7S8Y",
                      created: 1498500348,
                      is_im: true,
                      is_org_shared: false,
                      user: "U0BS9U4SV",
                      is_user_deleted: false,
                      priority: 0,
                    },
                    {
                      id: "D0BSHH4AD",
                      created: 1498511030,
                      is_im: true,
                      is_org_shared: false,
                      user: "U0C0NS9HN",
                      is_user_deleted: false,
                      priority: 0,
                    },
                  ],
                  response_metadata: {
                    next_cursor: "aW1faWQ6RDBCSDk1RExI",
                  },
                }
              } else {
                return {
                  ok: true,
                  channels: [
                    {
                      id: "C012AB3CD",
                      name: "general",
                      is_channel: true,
                      is_group: false,
                      is_im: false,
                      created: 1449252889,
                      creator: "U012A3CDE",
                      is_archived: false,
                      is_general: true,
                      unlinked: 0,
                      name_normalized: "general",
                      is_shared: false,
                      is_ext_shared: false,
                      is_org_shared: false,
                      pending_shared: [],
                      is_pending_ext_shared: false,
                      is_member: true,
                      is_private: false,
                      is_mpim: false,
                      topic: {
                        value: "Company-wide announcements and work-based matters",
                        creator: "",
                        last_set: 0,
                      },
                      purpose: {
                        value: "This channel is for team-wide communication and announcements.",
                        creator: "",
                        last_set: 0,
                      },
                      previous_names: [],
                      num_members: 4,
                    },
                    {
                      id: "C061EG9T2",
                      name: "random",
                      is_channel: true,
                      is_group: false,
                      is_im: false,
                      created: 1449252889,
                      creator: "U061F7AUR",
                      is_archived: false,
                      is_general: false,
                      unlinked: 0,
                      name_normalized: "random",
                      is_shared: false,
                      is_ext_shared: false,
                      is_org_shared: false,
                      pending_shared: [],
                      is_pending_ext_shared: false,
                      is_member: true,
                      is_private: false,
                      is_mpim: false,
                      topic: {
                        value: "Non-work banter and water cooler conversation",
                        creator: "",
                        last_set: 0,
                      },
                      purpose: {
                        value: "A place for non-work-related you'd prefer to keep out.",
                        creator: "",
                        last_set: 0,
                      },
                      previous_names: [],
                      num_members: 4,
                    }
                  ],
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
            {name: "10", label: "@Z"},
            {name: "20", label: "@Y"},
            {name: "30", label: "@W"},
            {name: "40", label: "@X"}],
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
