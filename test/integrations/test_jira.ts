import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { JiraIntegration } from "../../src/integrations/jira"

const integration = new JiraIntegration()

function expectJiraNewIssueMatch(request: D.DataActionRequest, match: any) {

  const addNewIssueSpy = sinon.spy(() => Promise.resolve(1))
  const addAttachmentonIssueSpy = sinon.spy(() => Promise.resolve(10))

  const stubClient = sinon.stub(integration as any, "jiraClientFromRequest")
    .callsFake(() => {
      return {
        addNewIssue: addNewIssueSpy,
        addAttachmentOnIssue: addAttachmentonIssueSpy,
        listProjects: () => [
          {id: "1", name: "A"},
          {id: "2", name: "B"}],
        listIssueTypes: () => [
          {id: "1", name: "Bug"},
          {id: "2", name: "Request"}],
      }
    })

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(addNewIssueSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("sends right body to key and bucket", () => {
      const request = new D.DataActionRequest()
      request.scheduledPlan = {url: "looker_url"}
      request.formParams = {
        project: "1",
        summary: "mysummary",
        description: "mydescription",
        issueType: "10",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectJiraNewIssueMatch(request, {
        fields: {
          project: {
            key: "1",
          },
          summary: "mysummary",
          description: "mydescription",
          issuetype: {
            id: "10",
          },
          lookerUrl: "looker_url",
        },
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

  })

})
