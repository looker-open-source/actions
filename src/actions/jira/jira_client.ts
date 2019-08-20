import * as querystring from "querystring"
import * as https from "request-promise-native"
import { Readable } from "stream"
import * as URL from "url"

interface Credentials {
  access_token: string
  scope: string
  expires_in: number
  token_type: string
}

interface JiraIssue {
  fields: {
    project: {
      id: string,
    };
    summary: string | undefined
    description: string
    issuetype: {
      id: string,
    }
  }
}

export class JiraClient {
  apiVersion: string
  redirectUri: string
  tokens?: Credentials
  cloudId?: string

  constructor(redirectUri: string, tokens?: Credentials, apiVersion?: string) {
    this.redirectUri = redirectUri
    this.tokens = tokens
    this.apiVersion = apiVersion || "2"
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
    // TODO protect from empty response
    return response[0].id
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
    const baseUrl = await this.baseUrl()
    return https.post({
      url: `${baseUrl}/issue`,
      headers: {
        Authorization: `Bearer ${this.tokens.access_token}`,
      },
      body: issue,
      json: true,
      followAllRedirects: true,
    })
  }

  async addAttachmentToIssue(attachment: Readable, issueId: string) {
    if (!this.tokens) {
      throw "unauthenticated"
    }

    const baseUrl = await this.baseUrl()

    return https.post({
      url: `${baseUrl}/${issueId}/attachments`,
      headers: {
        "Authorization": `Bearer ${this.tokens.access_token}`,
        "X-Atlassian-Token": "nocheck",
      },
      formData: {
        file: attachment,
      },
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
