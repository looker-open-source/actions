import {ChatPostMessageArguments, FilesUploadArguments, WebClient} from "@slack/web-api"
import * as chai from "chai"
import * as gaxios from "gaxios"
import * as sinon from "sinon"

import * as Hub from "../../hub"
import {displayError, getDisplayedFormFields, handleExecute} from "./utils"

const stubFileName = "stubSuggestedFilename"

function expectSlackMatchV1(request: Hub.ActionRequest, optionsMatch: FilesUploadArguments) {
    const slackClient = new WebClient("someToken")
    const expectedBuffer = optionsMatch.file as Buffer
    delete optionsMatch.file
    const filesUploadSpy = sinon.spy(async (params: any) => {
        chai.expect(params.file.toString()).to.equal(expectedBuffer.toString())
        return {}
    })
    const stubClient = sinon.stub(slackClient.files, "upload")
        .callsFake(filesUploadSpy)
    const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
        .callsFake(() => stubFileName)
    return chai.expect(handleExecute(request, slackClient)).to.be.fulfilled.then(() => {
        chai.expect(filesUploadSpy).to.have.been.calledWithMatch(optionsMatch)
        stubClient.restore()
        stubSuggestedFilename.restore()
    })
}

function expectSlackMatch(request: Hub.ActionRequest, optionsMatch: FilesUploadArguments) {

    const slackClient = new WebClient("someToken")
    const expectedBuffer = optionsMatch.file as Buffer
    const fileId = "1234ABCDX"
    delete optionsMatch.file
    const uploadUrlSpy = sinon.spy(async (_: any) => {
        return {
            upload_url: "https://fake-url.com",
            file_id: fileId,
        }
    })

    const filesUploadSpy = sinon.spy(async (params: any) => {
        chai.expect(params.data.toString()).to.equal(expectedBuffer.toString())
        return {}
    })

    const finalizeSpy = sinon.spy(async (params: any) => {
        chai.expect(params.files[0].id).to.equal(fileId)
        chai.expect(params.files[0].title).to.equal(optionsMatch.filename)
        chai.expect(params.channel_id).to.equal(optionsMatch.channels)
        chai.expect(params.initial_comment).to.equal(optionsMatch.initial_comment)
        chai.expect(params.initial_comment).to.equal("NOT A MATCH")
        return {}
    })

    const stubClientURL = sinon.stub(slackClient.files, "getUploadURLExternal").callsFake(uploadUrlSpy)
    const stubUpload = sinon.stub(gaxios, "request").callsFake(filesUploadSpy)
    const stubFinalize = sinon.stub(slackClient.files, "completeUploadExternal").callsFake(finalizeSpy)
    const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
        .callsFake(() => stubFileName)

    return chai.expect(handleExecute(request, slackClient)).to.be.fulfilled.then(() => {
        chai.expect(filesUploadSpy).to.have.been.called
        chai.expect(uploadUrlSpy).to.have.been.called
        chai.expect(filesUploadSpy).to.have.been.called
        chai.expect(finalizeSpy).to.have.been.called
        stubClientURL.restore()
        stubUpload.restore()
        stubFinalize.restore()
        stubSuggestedFilename.restore()
    })
}

function expectSlackChatMatch(request: Hub.ActionRequest, optionsMatch: ChatPostMessageArguments) {

    const slackClient = new WebClient("someToken")

    const stubClient = sinon.stub(slackClient.chat, "postMessage")

    const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
      .callsFake(() => stubFileName)

    return chai.expect(handleExecute(request, slackClient)).to.be.fulfilled.then(() => {
        chai.expect(stubClient).to.have.been.calledWithMatch(optionsMatch)
        stubClient.restore()
        stubSuggestedFilename.restore()
    })
}

describe(`slack/utils unit tests`, () => {

    describe("getDisplayedFormFields", () => {
        it("returns correct channels", (done) => {
            const slackClient = new WebClient("token")
            // @ts-ignore
            sinon.stub(slackClient.conversations, "list").callsFake((filters: any) => filters.cursor ?
              {
                  ok: true,
                  channels: [
                      {id: "3", name: "C"},
                      {id: "4", name: "D"},
                  ],
              } :
              {
                  ok: true,
                  channels: [
                      {id: "1", name: "A"},
                      {id: "2", name: "B"},
                  ],
                  response_metadata: {
                      next_cursor: "cursor",
                  },
              },
            )
            // @ts-ignore
            sinon.stub(slackClient.users, "list").callsFake((filters: any) => filters.cursor ?
                {
                    ok: true,
                    members: [
                        {id: "30", name: "W"},
                        {id: "40", name: "X"},
                    ],
                } :
                {
                    ok: true,
                    members: [
                        {id: "10", name: "Z"},
                        {id: "20", name: "Y"},
                    ],
                    response_metadata: {
                        next_cursor: "cursor",
                    },
                })
            const result = getDisplayedFormFields(slackClient, "channels")
            chai.expect(result).to.eventually.deep.equal([
                {
                    description: "Type of destination to fetch",
                    label: "Channel Type",
                    name: "channelType",
                    options: [
                        {name: "manual", label: "Manual Channel ID"},
                        {name: "channels", label: "Channels"},
                        {name: "users", label: "Users"},
                    ],
                    type: "select",
                    default: "manual",
                    interactive: true,
                },
                {
                    description: "Name of the Slack channel you would like to post to.",
                    label: "Share In",
                    name: "channel",
                    options: [
                        {name: "1", label: "#A"},
                        {name: "2", label: "#B"},
                        {name: "3", label: "#C"},
                        {name: "4", label: "#D"},
                    ],
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
                },
            ]).and.notify(done)
        })

        it("returns correct users", (done) => {
            const slackClient = new WebClient("token")
            // @ts-ignore
            sinon.stub(slackClient.conversations, "list").callsFake((filters: any) => filters.cursor ?
                {
                    ok: true,
                    channels: [
                        {id: "3", name: "C", is_member: true},
                        {id: "4", name: "D", is_member: true},
                    ],
                } :
                {
                    ok: true,
                    channels: [
                        {id: "1", name: "A", is_member: true},
                        {id: "2", name: "B", is_member: true},
                    ],
                    response_metadata: {
                        next_cursor: "cursor",
                    },
                },
            )
            // @ts-ignore
            sinon.stub(slackClient.users, "list").callsFake((filters: any) => filters.cursor ?
                {
                    ok: true,
                    members: [
                        {id: "30", name: "W"},
                        {id: "40", name: "X"},
                    ],
                } :
                {
                    ok: true,
                    members: [
                        {id: "10", name: "Z"},
                        {id: "20", name: "Y"},
                    ],
                    response_metadata: {
                        next_cursor: "cursor",
                    },
                })
            const result = getDisplayedFormFields(slackClient, "users")
            chai.expect(result).to.eventually.deep.equal([
                {
                    description: "Type of destination to fetch",
                    label: "Channel Type",
                    name: "channelType",
                    options: [
                        {name: "manual", label: "Manual Channel ID"},
                        {name: "channels", label: "Channels"},
                        {name: "users", label: "Users"},
                    ],
                    type: "select",
                    default: "manual",
                    interactive: true,
                },
                {
                    description: "Name of the Slack channel you would like to post to.",
                    label: "Share In",
                    name: "channel",
                    options: [
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
                },
            ]).and.notify(done)
        })

        it("returns form with manual enabled", (done) => {
            const slackClient = new WebClient("token")
            const result = getDisplayedFormFields(slackClient, "manual")
            chai.expect(result).to.eventually.deep.equal([
                {
                    description: "Type of destination to fetch",
                    label: "Channel Type",
                    name: "channelType",
                    options: [
                        {name: "manual", label: "Manual Channel ID"},
                        {name: "channels", label: "Channels"},
                        {name: "users", label: "Users"},
                    ],
                    type: "select",
                    default: "manual",
                    interactive: true,
                },
                {
                    description: "Slack channel or user id",
                    label: "Channel or User ID",
                    name: "channel",
                    type: "string",
                }, {
                    label: "Comment",
                    type: "string",
                    name: "initial_comment",
                }, {
                    label: "Filename",
                    name: "filename",
                    type: "string",
                },
            ]).and.notify(done)
        })
    })

    describe("handleExecute", () => {
        it("errors if there is no channel", (done) => {
            const slackClient = new WebClient()
            const request = new Hub.ActionRequest()
            request.formParams = {}
            request.attachment = {
                dataBuffer: Buffer.from("1,2,3,4", "utf8"),
                fileExtension: "csv",
            }
            chai.expect(handleExecute(request, slackClient)).to.eventually
                .be.rejectedWith("Missing channel.").and.notify(done)
        })

        it("sends to right body, channel and filename if specified", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.params = {
                slack_api_token: "token",
            }
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
                filename: `${request.formParams.filename}.csv`,
                channels: request.formParams.channel,
                initial_comment: request.formParams.initial_comment,
            })
        })

        it("sends right body and channel", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
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
                initial_comment: request.formParams.initial_comment,
            })
        })

        it("sends right body and channel if payload is empty", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.scheduledPlan = {}
            request.attachment = {}
            request.formParams.channel = "mychannel"
            request.formParams.initial_comment = "mycomment"
            return expectSlackChatMatch(request, {
                channel: request.formParams.channel,
                text: request.formParams.initial_comment,
            })
        })

        it("uses V1 if channel if FORCE_V1_UPLOAD is on", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.formParams = {
                channel: "mychannel",
                initial_comment: "mycomment",
            }
            request.attachment = {
                dataBuffer: Buffer.from("1,2,3,4", "utf8"),
                fileExtension: "csv",
            }
            process.env.FORCE_V1_UPLOAD = "on"
            const results = expectSlackMatchV1(request, {
                channels: request.formParams.channel,
                initial_comment: request.formParams.initial_comment,
                file: Buffer.from("1,2,3,4", "utf8"),
            })
            process.env.FORCE_V1_UPLOAD = ""
            return results
        })

        it("uses V1 if channel is a User token", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.formParams = {
                channel: "U12345",
                initial_comment: "mycomment",
            }
            request.attachment = {
                dataBuffer: Buffer.from("1,2,3,4", "utf8"),
                fileExtension: "csv",
            }
            return expectSlackMatchV1(request, {
                channels: request.formParams.channel,
                initial_comment: request.formParams.initial_comment,
                file: Buffer.from("1,2,3,4", "utf8"),
            })
        })

        it("uses V1 if channel is a User token with a W prefix", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.formParams = {
                channel: "W12345",
                initial_comment: "mycomment",
            }
            request.attachment = {
                dataBuffer: Buffer.from("1,2,3,4", "utf8"),
                fileExtension: "csv",
            }
            return expectSlackMatchV1(request, {
                channels: request.formParams.channel,
                initial_comment: request.formParams.initial_comment,
                file: Buffer.from("1,2,3,4", "utf8"),
            })
        })

        it("returns failure on slack files.upload error", (done) => {
            const request = new Hub.ActionRequest()
            const fileId = "1234ABCDX"
            request.type = Hub.ActionType.Query
            request.params = {
                slack_api_token: "token",
            }
            request.formParams = {
                channel: "mychannel",
                initial_comment: "mycomment",
            }
            request.attachment = {
                dataBuffer: Buffer.from("1,2,3,4", "utf8"),
                fileExtension: "csv",
            }

            const slackClient = new WebClient()
            const uploadUrlFailSpy = sinon.spy(async (_: any) => {
                return {
                    upload_url: "https://fake-url.com",
                    file_id: fileId,
                }
            })

            const filesUploadFailSpy = sinon.spy(async (_: any) => {
                return {}
            })

            const finalizeFailSpy = sinon.spy(async () => Promise.reject({
                type: "CHANNEL_NOT_FOUND",
                message: "Could not find channel mychannel",
            }))

            const stubClientURL = sinon.stub(slackClient.files, "getUploadURLExternal").callsFake(uploadUrlFailSpy)
            const stubUpload = sinon.stub(gaxios, "request").callsFake(filesUploadFailSpy)
            const stubFinalize = sinon.stub(slackClient.files, "completeUploadExternal").callsFake(finalizeFailSpy)

            chai.expect(handleExecute(request, slackClient)).to.eventually.deep.equal({
                success: false,
                message: "Could not find channel mychannel",
                refreshQuery: false,
                validationErrors: [],
            }).then(() => {
                stubClientURL.restore()
                stubUpload.restore()
                stubFinalize.restore()
                done()
            })
        })

    })

    describe("displayError", () => {
        it("returned found value", () => {
            chai.expect(displayError["An API error occurred: invalid_auth"]).to
                .equal("Your Slack authentication credentials are not valid.")

        })
    })

})
