import * as D from "../framework";

import * as Github from "github";

export class GitHubSource extends D.IntegrationSource {

  public async sourcedIntegrations() {

    let dest = new D.Integration();
    dest.name = "update_issue";
    dest.label = "Update GitHub Issue";
    dest.description = "Update open or closed status on a GitHub issue.";
    dest.params = [
      {
        description: "An API key for GitHub from https://github.com/settings/tokens.",
        label: "GitHub API Key",
        name: "github_api_key",
        required: true,
      },
    ];
    dest.supportedActionTypes = ["cell"];
    dest.supportedFormats = ["json"];
    dest.requiredFields = [
      {tag: "github_issue_url"},
    ];

    dest.action = async (request) => {
      let github = githubClientFromRequest(request);

      try {

        let issueParams = githubIssueFromRequest(request);
        let params = Object.assign(issueParams, {
          body: request.formParams.body,
          state: request.formParams.state,
          title: request.formParams.title,
        });

        await github.issues.edit(params);

      } catch (e) {
        throw e.message;
      }
      return new D.DataActionResponse();
    };

    dest.form = async (request) => {
      let github = githubClientFromRequest(request);

      let form = new D.DataActionForm();
      try {

        let issue = await github.issues.get(githubIssueFromRequest(request));

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
        }];

      } catch (e) {
        throw e.message;
      }

      return form;
    };

    return [dest];
  }

}

function githubIssueFromRequest(request: D.DataActionRequest) {
  let splits = request.params.value.split("/");
  let owner = splits[3];
  let repo = splits[4];
  let num = splits[6];
  return {
    owner,
    repo,
    number: parseInt(num, 10),
  };
}

function githubClientFromRequest(request: D.DataActionRequest) {
  let github = new Github();

  github.authenticate({
    token: request.params.github_api_key,
    type: "oauth",
  });

  return github;
}
