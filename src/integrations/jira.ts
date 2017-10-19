import * as D from "../framework"

const jiraApi = require("jira-client")

const apiVersion = "2"

export class JiraIntegration extends D.Integration {

  constructor() {
    super()
    this.name = "jira_create_issue"
    this.label = "JIRA"
    this.iconName = "jira.svg"
    this.description = "Create a JIRA issue referencing a Look."
    this.params = [
      {
        description: "The port your JIRA server is listening on (probably `80` or `443`)",
        label: "Port",
        name: "port",
        required: true,
        sensitive: false,
      }, {
        description: "The hostname for your JIRA server.",
        label: "Host",
        name: "host",
        required: true,
        sensitive: false,
      }, {
        description: "The JIRA username assigned to create issues for Looker",
        label: "Username",
        name: "username",
        required: true,
        sensitive: false,
      }, {
        description: "The password for the JIRA user assigned to Looker",
        label: "Password",
        name: "password",
        required: true,
        sensitive: true,
      },
    ]
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
  }

  async action(request: D.DataActionRequest) {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment"
    }

    if (!request.formParams) {
      throw "Need JIRA issue fields."
    }

    const jira = this.jiraClientFromRequest(request)

    const issue = {
      fields: {
        project: {
          id: request.formParams.project,
        },
        summary: request.formParams.summary,
        description: `${request.formParams.description}` +
          `\nLooker URL: ${request.scheduledPlan && request.scheduledPlan.url}`,
        issuetype: {
          id: request.formParams.issueType,
        },
      },
    }
    let response
    try {
      await jira.addNewIssue(issue)
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return new D.DataActionResponse(response)
  }

  async form(request: D.DataActionRequest) {

    const jira = this.jiraClientFromRequest(request)
    const form = new D.DataActionForm()
    try {

      const [projects, issueTypes] = await Promise.all([
        jira.listProjects(),
        jira.listIssueTypes(),
      ])

      form.fields = [{
        default: projects[0].id,
        label: "Project",
        name: "project",
        options: projects.map((p: any) => {
          return {name: p.id, label: p.name}
        }),
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
        default: issueTypes[0].id,
        label: "Issue Type",
        name: "issueType",
        type: "select",
        options: issueTypes
          .filter((i: any) => i.description)
          .map((p: any) => {
            return {name: p.id, label: p.name}
          }),
        required: true,
      }]
      return form
    } catch (e) {
      throw e.message
    }
  }

  private jiraClientFromRequest(request: D.DataActionRequest) {
    return new jiraApi({
      protocol: "https",
      host: request.params.host,
      port: request.params.port,
      username: request.params.username,
      password: request.params.password,
      apiVersion,
    })
  }

}

D.addIntegration(new JiraIntegration())
