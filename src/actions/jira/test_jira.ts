import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { JiraAction } from "./jira"

const action = new JiraAction()

function expectJiraNewIssueMatch(request: Hub.ActionRequest, match: any) {

  const addNewIssueSpy = sinon.spy(async () => 1)
  const addAttachmentonIssueSpy = sinon.spy(async () => 10)

  const stubClient = sinon.stub(action as any, "jiraClientFromRequest")
    .callsFake(() => {
      return {
        addNewIssue: addNewIssueSpy,
        addAttachmentOnIssue: addAttachmentonIssueSpy,
      }
    })

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(addNewIssueSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("sends correct jira new issue", () => {
      const request = new Hub.ActionRequest()
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
            id: "1",
          },
          summary: "mysummary",
          description: "mydescription" + "\nLooker URL: looker_url",
          issuetype: {
            id: "10",
          },
        },
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with correct projects and issues", (done) => {
      const stubClient = sinon.stub(action as any, "jiraClientFromRequest")
        .callsFake(() => {
          return {
            listProjects: () => [
              {id: "1", name: "A"},
              {id: "2", name: "B"}],
            listIssueTypes: () => [
              {id: "1", name: "Bug", description: "x"},
              {id: "2", name: "Request"}],
          }
        })
      const request = new Hub.ActionRequest()
      request.params = {
        address: "foo",
        username: "foo",
        password: "foo",
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
          default: "1",
          label: "Issue Type",
          name: "issueType",
          type: "select",
          options: [{name: "1", label: "Bug"}],
          required: true,
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("properly surfaces client errors", (done) => {
      const stubClient = sinon.stub(action as any, "jiraClientFromRequest")
        .callsFake(() => {
          throw "hahaha i failed"
        })
      const request = new Hub.ActionRequest()
      request.params = {
        address: "foo",
        username: "foo",
        password: "foo",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        error: "hahaha i failed",
        fields: [],
      }).and.notify(stubClient.restore).and.notify(done)
    })
  })

})
