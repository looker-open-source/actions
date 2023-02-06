import * as Hub from "../../hub"

import * as https from "request-promise-native"
import * as winston from "winston"

import { Credentials, JiraClient } from "./jira_client"

interface ProjectOption {
  name: string
  label: string
  issueTypes: IssueType[]
}

interface IssueType {
  name: string
  label: string
}

export class JiraAction extends Hub.OAuthAction {
  name = "jira_create_issue"
  label = "JIRA"
  iconName = "jira/jira.svg"
  description = "Create a JIRA issue referencing data."
  params = []
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  usesStreaming = false
  minimumSupportedLookerVersion = "6.8.0"

  async execute(request: Hub.ActionRequest) {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }
    const buffer = request.attachment.dataBuffer
    const filename = request.formParams.filename || request.suggestedFilename()

    const resp = new Hub.ActionResponse()

    if (!request.params.state_json) {
      resp.success = false
      resp.state = new Hub.ActionState()
      resp.state.data = "reset"
      return resp
    }

    let url
    if (request.scheduledPlan) {
      if (request.scheduledPlan.url) {
        url = request.scheduledPlan.url
      }
    }
    const issue = {
      project: {
        id: request.formParams.project!,
      },
      summary: request.formParams.summary,
      description: request.formParams.description,
      url,
      issuetype: {
        id: request.formParams.issueType!,
      },
      epicName: request.formParams.epicName,
      parent: {
        key: request.formParams.parentIssue,
      },
    }

    const stateJson = JSON.parse(request.params.state_json)
    if (stateJson.tokens && stateJson.redirect) {
      try {
        const client = await this.jiraClient(stateJson.redirect, stateJson.tokens)
        const newIssue = await client.newIssue(issue)
        await client.addAttachmentToIssue(newIssue.key, buffer, filename, request.attachment.mime)
        resp.success = true
      } catch (e) {
        resp.success = false
        if (e instanceof Error) {
          resp.message = e.message
        }
      }
    } else {
      resp.success = false
      resp.state = new Hub.ActionState()
      resp.state.data = "reset"
    }
    return new Hub.ActionResponse(resp)
  }

  async form(request: Hub.ActionRequest) {
    if (request.params.state_json) {
      try {
        const stateJson = JSON.parse(request.params.state_json)
        if (stateJson.tokens && stateJson.redirect) {
          let tokens = stateJson.tokens
          if (stateJson.tokens.refresh_token && Object.keys(request.formParams).length === 0) {
            tokens = await JiraClient.getRefreshToken(stateJson.tokens.refresh_token, stateJson.redirect)
          }
          const client = await this.jiraClient(stateJson.redirect, tokens)
          const projects = await client.getProjects()
          const projectOptions: ProjectOption[] = projects.map((p: any) => {
            const issueTypes: IssueType[] = p.issueTypes.map((i: any) => {
              return { name: i.id, label: i.name }
            })
            issueTypes.sort((a, b) => ((a.name > b.name) ? -1 : 1))
            return { name: p.id, label: p.name, issueTypes }
          })
          projectOptions.sort((a, b) => ((a.label < b.label) ? -1 : 1))

          let issueTypesOptions = projectOptions[0].issueTypes
          if (request.formParams.project) {
            const selectedProject = projectOptions.find((p: any) => request.formParams.project === p.name)
            if (selectedProject) {
              issueTypesOptions = selectedProject.issueTypes
            }
          }

          const form = new Hub.ActionForm()
          const newState = JSON.stringify({ tokens, redirect : stateJson.redirect })
          form.state = new Hub.ActionState()
          form.state.data = newState
          form.fields = [{
            default: projectOptions[0].name,
            label: "Project",
            name: "project",
            options: projectOptions.map((p: any) => ({ name: p.name, label: p.label })),
            type: "select",
            required: true,
            interactive: true,
          }, {
            label: "Issue Type",
            name: "issueType",
            type: "select",
            options: issueTypesOptions,
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
            label: "Filename",
            name: "filename",
            type: "string",
            required: false,
          }]

          if (request.formParams.project && request.formParams.issueType) {
            const selectedIssueType = request.formParams.issueType
            if (selectedIssueType === "10003") {
              // this is a sub-task and it needs an associated parent task
              const parentIssues = await client.getParentIssues(request.formParams.project)
              const parentIssueOptions: IssueType[] = parentIssues.issues.map((pi: any) => {
                return { name: pi.key, label: `${pi.key} ${pi.fields.summary}` }
              })
              form.fields.push({
                label: "Parent Issue",
                name: "parentIssue",
                type: "select",
                options: parentIssueOptions,
                required: true,
              })
            } else if (selectedIssueType === "10000") {
              // this is an epic and it needs a name
              form.fields.push({
                label: "Epic Name",
                name: "epicName",
                type: "string",
                required: true,
              })
            }
          }
          return form
        }
      } catch (e) { winston.warn("Log in fail") }
    }
    return this.loginForm(request)
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {
    const client = await this.jiraClient(redirectUri)
    const scope = "read:jira-user read:jira-work write:jira-work offline_access"
    return client.generateAuthUrl(encryptedState, scope)
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    const actionCrypto = new Hub.ActionCrypto()
    const plaintext = await actionCrypto.decrypt(urlParams.state).catch((err: string) => {
      winston.error("Encryption not correctly configured" + err)
      throw err
    })

    const client = await this.jiraClient(redirectUri)
    const tokens = await client.getToken(urlParams.code)

    const payload = JSON.parse(plaintext)
    await https.post({
      url: payload.stateurl,
      body: JSON.stringify({ tokens, redirect: redirectUri }),
    }).promise().catch((_err) => { winston.error(_err.toString()) })
  }

  async oauthCheck(request: Hub.ActionRequest) {
    if (request.params.state_json) {
      try {
        const stateJson = JSON.parse(request.params.state_json)
        if (stateJson.tokens && stateJson.redirect) {
          const client = await this.jiraClient(stateJson.redirect, stateJson.tokens)
          await client.getCloudIdFromTokens()
        }
        return true
      } catch (err) {
        winston.error(`Error in oauthCheck ${JSON.stringify(err)}`)
        return false
      }
    }
    return false
  }

  protected async jiraClient(redirect: string, tokens?: Credentials) {
    const jiraClient = new JiraClient(redirect, tokens)
    if (tokens) {
      await jiraClient.setCloudIdFromTokens()
    }
    return jiraClient
  }

  private async loginForm(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    const actionCrypto = new Hub.ActionCrypto()
    const jsonString = JSON.stringify({ stateurl: request.params.state_url })
    const ciphertextBlob = await actionCrypto.encrypt(jsonString).catch((err: string) => {
      winston.error("Encryption not correctly configured")
      throw err
    })
    form.fields = [{
      name: "login",
      type: "oauth_link",
      label: "Log in",
      description: "In order to create an Issue, you will need to log in" +
        " to your Jira account.",
      oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/${this.name}/oauth?state=${ciphertextBlob}`,
    }]
    return form
  }
}

if (process.env.JIRA_CLIENT_ID && process.env.JIRA_CLIENT_SECRET) {
  Hub.addAction(new JiraAction())
}
