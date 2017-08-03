import * as D from "../framework"

const jiraApi = require("jira-client")

const apiVersion = "2"

export class JiraIntegration extends D.Integration {

  constructor() {
    super()
    this.name = "jira_create_issue"
    this.label = "JIRA"
    this.iconName = "jira.svg"
    this.description = "Create JIRA issue referencing a Look."
    this.params = [
      {
        description: "The hostname for your JIRA server.",
        label: "Host",
        name: "host",
        required: true,
      }, {
        description: "The port your JIRA server is listening on (probably `80` or `443`)",
        label: "Port",
        name: "port",
        required: true,
      }, {
        description: "Typically 'http' or 'https'",
        label: "Protocol",
        name: "protocol",
        required: true,
      }, {
        description: "The JIRA username assigned to create issues for Looker",
        label: "Username",
        name: "username",
        required: true,
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
    return new Promise<D.DataActionResponse>((resolve, reject) => {

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

      jira.addNewIssue(issue)
        .then((createdIssue: any) => {
          jira.addAttachmentOnIssue(
            createdIssue.id,
            request.attachment && request.attachment.dataBuffer)
            .then(() => resolve(new D.DataActionResponse()))
            .catch((err: any) => {
              reject(err)
            })
        })
        .catch((err: any) => {
          reject(err)
        })
    })
  }

  async form(request: D.DataActionRequest) {

    const jira = this.jiraClientFromRequest(request)
    const form = new D.DataActionForm()
    try {
      const projects = await jira.listProjects()
      const issueTypes = await jira.listIssueTypes()

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
    } catch (e) {
      throw e.message
    }
    return form
  }

  private jiraClientFromRequest(request: D.DataActionRequest) {
    return new jiraApi({
      protocol: request.params.protocol,
      host: request.params.host,
      port: request.params.port,
      username: request.params.username,
      password: request.params.password,
      apiVersion,
    })
  }

}

D.addIntegration(new JiraIntegration())
