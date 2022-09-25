import * as b64 from "base64-url"
import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { JiraAction } from "./jira"

const action = new JiraAction()


function expectJiraNewIssueMatch(request: Hub.ActionRequest, match: any) {
  const addAttachmentToIssueSpy = sinon.spy(async () => 1)
  const newIssueSpy = sinon.spy(async () => 1)
  const stubClient = sinon.stub(action as any, "jiraClient")
    .callsFake(() => {
      return {
        addAttachmentToIssue: addAttachmentToIssueSpy,
        newIssue: newIssueSpy
      }
  })
  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(newIssueSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
  })

}

describe(`${action.constructor.name} unit tests`, () => {

  let encryptStub: any
  let decryptStub: any
  beforeEach(() => {
    encryptStub = sinon.stub(Hub.ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    decryptStub = sinon.stub(Hub.ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
  })
  afterEach(() => {
    encryptStub.restore()
    decryptStub.restore()
  })

  describe("action", () => {

    it("sends correct jira new issue", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        project: '1',
        summary: 'mysummary',
        description: 'mydescription',
        issueType: '10',
      }
      request.params = { 
        state_json: '{\"tokens\": \"tokens\", \"redirect\": \"redirect\"}'
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectJiraNewIssueMatch(request, {
        project: {
          id: '1',
        },
        summary: 'mysummary',
        description: 'mydescription',
        issuetype: {
          id: '10',
        },
        epicName: undefined,
        parent: { key: undefined },
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with correct projects and issues", (done) => {
      const projects = [{
                  id: "1", 
                  name: "A",
                  issueTypes: [
                    {id: "1", name: "Bug"},
                    {id: "2", name: "Request"}
                  ],
                },
                {
                  id: "2", 
                  name: "B",
                  issueTypes: [
                    {id: "1", name: "Bug"},
                  ],
                }
              ]

      const stubClient = sinon.stub(action as any, "jiraClient")
        .callsFake(() => {
          return {
            getProjects: () => projects
          }
        })
      const request = new Hub.ActionRequest()
      request.params = { 
        state_json: '{\"tokens\": \"tokens\", \"redirect\": \"redirect\"}'
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          default: '1',
          label: "Project",
          name: "project",
          options: [{name: "1", label: "A"}, {name: "2", label: "B"}],
          type: "select",
          required: true,
          interactive: true,
        }, {
          label: "Issue Type",
          name: "issueType",
          type: "select",
          options: [{label: "Request", name: "2"}, {name: "1", label: "Bug"}],
          required: true,
          interactive: true,
        }, {
          label: "Summary",
          name: "summary",
          type: "string",
          required: true,
        }, {
          label: "Description",
          name: "description",
          type: "textarea",
          required: false,
        }, {
          label: 'Filename',
          name: 'filename',
          type: 'string',
          required: false
        }],
        state: {
          data: '{"tokens":"tokens","redirect":"redirect"}'
        },
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("show login form when auth fails", (done) => {
      const request = new Hub.ActionRequest()
      request.params = { 
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
                  name: "login",
                  type: "oauth_link",
                  label: "Log in",
                  description: "In order to create an Issue, you will need to log in" +
                    " to your Jira account.",
                  oauth_url: "undefined/actions/jira_create_issue/oauth?state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0"
                }],
      }).and.notify(done)
    })
  })

})
