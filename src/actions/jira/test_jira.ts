import * as b64 from "base64-url"
import * as chai from "chai"
import * as https from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { JiraAction } from "./jira"

import { Readable } from "stream"

import { ActionCrypto } from "../../hub"

import concatStream = require("concat-stream")

const action = new JiraAction()

async function expectJiraNewIssueMatch(request: Hub.ActionRequest, issueMatch: any, attachmentMatch: any) {

  const expectedBuffer = attachmentMatch.attachment
  delete attachmentMatch.attachment

  const newIssueSpy = sinon.spy(async () => ({id: 1}))
  const addAttachmentToIssueSpy = sinon.spy(async (attachment: Readable) => {
    attachment.pipe(concatStream((buffer) => {
      chai.expect(buffer.toString()).to.equal(expectedBuffer.toString())
    }))
    return { promise: async () => Promise.resolve({id: 10}) }
  })

  const stubClient = sinon.stub(action as any, "jiraClient")
    .callsFake(() => {
      return {
        newIssue: newIssueSpy,
        addAttachmentToIssue: addAttachmentToIssueSpy,
      }
    })

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(newIssueSpy).to.have.been.calledWithMatch(issueMatch)
    chai.expect(addAttachmentToIssueSpy).to.have.been.called
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

    it("sends correct jira new issue", async () => {
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"tokens": "tokens", "redirect": "redirect"}`,
      }
      request.scheduledPlan = {url: "looker_url"}
      request.formParams = {
        project: "1",
        summary: "mysummary",
        description: "mydescription",
        issueType: "10004",
      }
      const dataBuffer = Buffer.from("1,2,3,4", "utf8")
      request.attachment = {dataBuffer}
      return expectJiraNewIssueMatch(request, {
        project: {
          id: "1",
        },
        summary: "mysummary",
        description: "mydescription",
        url: "looker_url",
        issuetype: {
          id: "10004",
        },
      }, {
        attachment: dataBuffer,
        issueId: "1",
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with correct projects and issues", (done) => {
      const stubClient = sinon.stub(action as any, "jiraClient")
        .callsFake(() => {
          return {
            getProjects: () => [
              {id: "1", name: "A"},
              {id: "2", name: "B"},
            ],
          }
        })
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"tokens": "tokens", "redirect": "redirect"}`,
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          default: "1",
          label: "Project",
          name: "project",
          options: [{name: "1", label: "A"}, {name: "2", label: "B"}],
          type: "select",
          required: true,
        }, {
          label: "Summary",
          name: "summary",
          type: "string",
          required: true,
        }, {
          label: "Description",
          name: "description",
          type: "textarea",
          required: true,
        }, {
          default: "10004",
          label: "Issue Type",
          name: "issueType",
          type: "select",
          options: [{
            name: "10004",
            label: "Bug",
          }, {
            name: "10003",
            label: "Sub-task",
          }, {
            name: "10002",
            label: "Task",
          }, {
            name: "10001",
            label: "Story",
          }, {
            name: "10000",
            label: "Epic",
          }],
          required: true,
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("returns an oauth form on bad login", (done) => {
      const stubClient = sinon.stub(action as any, "jiraClient")
        .callsFake(() => ({
          getProjects: async (_: any) => Promise.reject("haha I failed auth"),
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"tokens": "tokens", "redirect": "redirect"}`,
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          description: "In order to create an Issue, you will need to log in" +
            " to your Jira account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/jira_create_issue/oauth?state=` +
            `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("does not blow up on bad state JSON and returns an OAUTH form", (done) => {
      const stubClient = sinon.stub(action as any, "jiraClient")
        .callsFake(() => ({
          getProjects: async (_: any) => Promise.reject("haha I failed auth"),
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"tokens": "tokens", "redirect": "redirect"}`,
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          description: "In order to create an Issue, you will need to log in" +
          " to your Jira account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/jira_create_issue/oauth?state=` +
            `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })

  })

  describe("oauth", () => {
    it("returns correct redirect url", () => {
      process.env.JIRA_CLIENT_ID = "testingkey"
      const prom = action.oauthUrl("https://actionhub.com/actions/jira_create_issue/oauth_redirect",
        `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`)
      return chai.expect(prom).to.eventually.equal("https://auth.atlassian.com/authorize?" +
      "audience=api.atlassian.com&" +
      "client_id=testingkey&" +
      "scope=read%3Ajira-user%20read%3Ajira-work%20write%3Ajira-work&" +
      "redirect_uri=https%3A%2F%2Factionhub.com%2Factions%2Fjira_create_issue%2Foauth_redirect&" +
      "state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0&" +
      "response_type=code&" +
      "prompt=consent",
      )
    })

    it("correctly handles redirect from authorization server", (done) => {
      const stubReq = sinon.stub(https, "post").callsFake(async () => Promise.resolve({
        success: true,
      }))
      const result = action.oauthFetchInfo({code: "code",
        state: `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZh` +
          `c2RmIiwiYXBwIjoibXlrZXkifQ`},
        "redirect")
      chai.expect(result)
        .and.notify(stubReq.restore).and.notify(done)
    })
  })

})
