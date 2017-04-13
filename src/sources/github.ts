import * as D from "../framework";

import * as Github from "github";

export class GitHubSource extends D.DestinationSource {

  async sourcedDestinations() {

    let dest = new D.Destination();
    dest.name = "update_issue";
    dest.label = "Update GitHub Issue";
    dest.description = "Update open or closed status on a GitHub issue.";
    dest.params = [
      {
        name: "github_api_key",
        label: "GitHub API Key",
        required: true,
        description: "An API key for GitHub from https://github.com/settings/tokens."
      }
    ];
    dest.supportedActionTypes = ["cell"];
    dest.supportedFormats = ["json"];
    dest.requiredFields = [
      {tag: "github_issue_url"},
    ];

    dest.action = async function(request) {
      let github = githubClientFromRequest(request);

      try {

        let issueParams = githubIssueFromRequest(request);
        let params = Object.assign(issueParams, {
          state: request.formParams["state"],
          title: request.formParams["title"],
          body: request.formParams["body"],
        });

        let issue = await github.issues.edit(params);

      } catch (e) {
        throw e.message;
      }
      return new D.DataActionResponse();
    }

    dest.form = async function(request) {
      let github = githubClientFromRequest(request);

      let form = new D.DataActionForm();
      try {

        let issue = await github.issues.get(githubIssueFromRequest(request))

        form.fields = [{
          type: "string",
          label: "Title",
          name: "title",
          required: true,
          default: issue.data.title,
        },{
          type: "textarea",
          label: "Body",
          name: "body",
          default: issue.data.body,
        },{
          type: "select",
          label: "State",
          name: "state",
          required: true,
          default: issue.data.state,
          options: [{name: "open", label: "Open"}, {name: "closed", label: "Closed"}],
        }];

      } catch (e) {
        throw e.message;
      }

      return form;
    }

    return [dest];
  }

}

function githubIssueFromRequest(request : D.DataActionRequest) {
  let [x, xx, xxx, owner, repo, xxxx, number] = request.params["value"].split("/");
  return {
    owner: owner,
    repo: repo,
    number: parseInt(number, 10),
  };
}

function githubClientFromRequest(request : D.DataActionRequest) {
  let github = new Github();

  github.authenticate({
    type: "oauth",
    token: request.params["github_api_key"],
  });

  return github;
}
