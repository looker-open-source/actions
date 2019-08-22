import * as querystring from "querystring"
import * as https from "request-promise-native"
import { Readable } from "stream"
import * as URL from "url"

import { Document } from "adf-builder"

interface Credentials {
  access_token: string
  scope: string
  expires_in: number
  token_type: string
}

interface JiraIssue {
  project: {
    id: string,
  }
  summary?: string
  description?: string
  url?: string
  issuetype: {
    id: string,
  }
}

export class JiraClient {
  apiVersion: string
  redirectUri: string
  tokens?: Credentials
  cloudId?: string

  constructor(redirectUri: string, tokens?: Credentials, apiVersion = "3") {
    this.redirectUri = redirectUri
    this.tokens = tokens
    this.apiVersion = apiVersion
  }

  generateAuthUrl(encryptedState: string, scope: string) {
    const url = new URL.URL("https://auth.atlassian.com/authorize")
    url.search = querystring.stringify({
      audience: "api.atlassian.com",
      client_id: process.env.JIRA_CLIENT_ID,
      scope,
      redirect_uri: this.redirectUri,
      state: encryptedState,
      response_type: "code",
      prompt: "consent",
    })
    return url.toString()
  }

  async setCloudIdFromTokens() {
    if (!this.tokens) {
      throw "unauthenticated"
    }
    this.cloudId = await this.getCloudIdFromTokens()
    return this.cloudId
  }

  async getCloudIdFromTokens() {
    if (!this.tokens) {
      throw "unauthenticated"
    }
    const options = {
      url: "https://api.atlassian.com/oauth/token/accessible-resources",
      headers: {
        Authorization: `Bearer ${this.tokens.access_token}`,
      },
      json: true,
    }

    const response = await https.get(options)
    if (response.length === 0) {
      throw "no cloudId"
    } else {
      return response[0].id
    }
  }

  async getToken(code: string) {
    const response: Credentials = await https.post({
      url: "https://auth.atlassian.com/oauth/token",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        grant_type: "authorization_code",
        code,
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        redirect_uri: this.redirectUri,
      },
      json: true,
    })
    return response
  }

  async getProjects() {
    if (!this.tokens) {
      throw "unauthenticated"
    }
    const baseUrl = await this.baseUrl()
    return https.get({
      url: `${baseUrl}/project`,
      headers: {
        Authorization: `Bearer ${this.tokens.access_token}`,
      },
      json: true,
    })
  }

  async getIssueTypes() {
    if (!this.tokens) {
      throw "unauthenticated"
    }
    const baseUrl = await this.baseUrl()
    return https.get({
      url: `${baseUrl}/issuetype`,
      headers: {
        Authorization: `Bearer ${this.tokens.access_token}`,
      },
      json: true,
    })
  }

  async newIssue(issue: JiraIssue) {
    if (!this.tokens) {
      throw "unauthenticated"
    }
    const description = new Document()
    if (issue.description) {
      description.paragraph().text(issue.description)
    }
    if (issue.url) {
      description.paragraph().link("Looker URL", issue.url)
    }

    const body = {
      fields: {
        project: {
          id: issue.project.id,
        },
        issuetype: {
          id: issue.issuetype.id,
        },
        summary: issue.summary,
        description,
      },
    }

    const baseUrl = await this.baseUrl()
    return https.post({
      url: `${baseUrl}/issue`,
      headers: {
        Authorization: `Bearer ${this.tokens.access_token}`,
      },
      body,
      json: true,
      followAllRedirects: true,
    })
  }

  async addAttachmentToIssue(attachment: Readable, issueId: string, contentLength?: number) {
    if (!this.tokens) {
      throw "unauthenticated"
    }

    const baseUrl = await this.baseUrl()
    let formData
    if (contentLength !== undefined) {
      formData = {
        file: {
          value: attachment,
          options: {
            knownLength: contentLength,
          },
        },
      }
    } else {
      formData = {
        file: attachment,
      }
    }

    return https.post({
      url: `${baseUrl}/${issueId}/attachments`,
      headers: {
        "Authorization": `Bearer ${this.tokens.access_token}`,
        "X-Atlassian-Token": "nocheck",
      },
      formData,
      json: true,
    })
  }

  async request(url: string, options: https.Options) {
    const baseUrl = await this.baseUrl()
    return https(`${baseUrl}/${url}`, options)
  }

  protected async baseUrl() {
    if (!this.cloudId) {
      await this.setCloudIdFromTokens()
    }
    return `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/api/${this.apiVersion}`
  }
}
