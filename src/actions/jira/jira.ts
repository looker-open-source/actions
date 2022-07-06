import * as Hub from "../../hub"

import * as https from "request-promise-native"
import * as winston from "winston"

import { Credentials, JiraClient } from "./jira_client"

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
    const filename = request.formParams.filename || request.suggestedFilename()!

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
        resp.message = e.message
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
          const client = await this.jiraClient(stateJson.redirect, stateJson.tokens)
          const projects = await client.getProjects()
          const projectOptions: { name: string, label: string }[] = projects.map((p: any) => {
            return { name: p.id, label: p.name }
          })

          const issueTypesOptions = [{
            name: "10000",
            label: "Epic",
          }, {
            name: "10001",
            label: "Story",
          }, {
            name: "10002",
            label: "Task",
          }, {
            name: "10003",
            label: "Sub-task",
          }, {
            name: "10004",
            label: "Bug",
          }]          
          projectOptions.sort((a, b) => ((a.label < b.label) ? -1 : 1 ))
          issueTypesOptions.sort((a, b) => ((a.name > b.name) ? -1 : 1 ))

          const form = new Hub.ActionForm()
          form.fields = [{
            default: projectOptions[0].name,
            label: "Project",
            name: "project",
            options: projectOptions,
            type: "select",
            required: true,
          }, {
            default: issueTypesOptions[0].name,
            label: "Issue Type",
            name: "issueType",
            type: "select",
            options: issueTypesOptions,
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
            required: false,
          }, {
            label: "Filename",
            name: "filename",
            type: "string",
            required: false,
          }]
          return form
        }
      } catch (e) { winston.warn(`Log in fail ${JSON.stringify(e)}`) }
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

    winston.info(`oauthFetchInfo tokens: ${JSON.stringify(tokens)}`)
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
