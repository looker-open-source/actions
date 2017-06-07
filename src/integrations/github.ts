import * as D from "../framework"

import * as Github from "github"

D.addIntegration({
  name: "github_update_issue",
  label: "GitHub - Update Issue",
  iconName: "github.svg",
  description: "Update status, title, and body for GitHub issues.",
  params: [
    {
      description: "An API key for GitHub from https://github.com/settings/tokens.",
      label: "GitHub API Key",
      name: "github_api_key",
      required: true,
      sensitive: true,
    },
  ],
  supportedActionTypes: ["cell"],
  supportedFormats: ["json"],
  requiredFields: [
    {tag: "github_issue_url"},
  ],
  action: async (request) => {
    const github = githubClientFromRequest(request)

    try {

      const issueParams = githubIssueFromRequest(request)
      const params = Object.assign(issueParams, {
        body: request.formParams.body,
        state: request.formParams.state,
        title: request.formParams.title,
      })

      await github.issues.edit(params)

    } catch (e) {
      throw e.message
    }
    return new D.DataActionResponse()
  },

  form: async (request) => {
    const github = githubClientFromRequest(request)

    const form = new D.DataActionForm()
    try {

      const issue = await github.issues.get(githubIssueFromRequest(request))

      form.fields = [{
        default: issue.data.title,
        label: "Title",
        name: "title",
        required: true,
        type: "string",
      }, {
        default: issue.data.body,
        label: "Body",
        name: "body",
        type: "textarea",
      }, {
        default: issue.data.state,
        label: "State",
        name: "state",
        options: [
          {name: "open", label: "Open"},
          {name: "closed", label: "Closed"},
        ],
        required: true,
        type: "select",
      }]

    } catch (e) {
      throw e.message
    }

    return form
  },
})

function githubIssueFromRequest(request: D.DataActionRequest) {
  const splits = request.params.value.split("/")
  const owner = splits[3]
  const repo = splits[4]
  const num = splits[6]
  return {
    owner,
    repo,
    number: parseInt(num, 10),
  }
}

function githubClientFromRequest(request: D.DataActionRequest) {
  const github = new Github()

  github.authenticate({
    token: request.params.github_api_key,
    type: "oauth",
  })

  return github
}
