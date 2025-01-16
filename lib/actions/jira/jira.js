"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraAction = void 0;
const Hub = require("../../hub");
const url_1 = require("url");
const jiraApi = require("jira-client");
const apiVersion = "2";
class JiraAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "jira_create_issue";
        this.label = "JIRA";
        this.iconName = "jira/jira.svg";
        this.description = "Create a JIRA issue referencing data.";
        this.params = [
            {
                description: "The address of your JIRA server ex. https://myjira.atlassian.net.",
                label: "Address",
                name: "address",
                required: true,
                sensitive: false,
            }, {
                description: "The JIRA username assigned to create issues for Looker.",
                label: "Username",
                name: "username",
                required: true,
                sensitive: false,
            }, {
                description: "The password for the JIRA user assigned to Looker.",
                label: "Password",
                name: "password",
                required: true,
                sensitive: true,
            },
        ];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.requiredFields = [];
    }
    async execute(request) {
        if (!request.attachment || !request.attachment.dataBuffer) {
            throw "Couldn't get data from attachment";
        }
        const jira = this.jiraClientFromRequest(request);
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
        };
        let response;
        try {
            await jira.addNewIssue(issue);
        }
        catch (e) {
            response = { success: false, message: e.message };
        }
        return new Hub.ActionResponse(response);
    }
    async form(request) {
        const form = new Hub.ActionForm();
        try {
            const jira = this.jiraClientFromRequest(request);
            const [projects, issueTypes] = await Promise.all([
                jira.listProjects(),
                jira.listIssueTypes(),
            ]);
            form.fields = [{
                    default: projects[0].id,
                    label: "Project",
                    name: "project",
                    options: projects.map((p) => {
                        return { name: p.id, label: p.name };
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
                        .filter((i) => i.description)
                        .map((p) => {
                        return { name: p.id, label: p.name };
                    }),
                    required: true,
                }];
        }
        catch (e) {
            form.error = e;
        }
        return form;
    }
    jiraClientFromRequest(request) {
        const parsedUrl = new url_1.URL(request.params.address);
        if (!parsedUrl.host) {
            throw "Invalid JIRA server address.";
        }
        return new jiraApi({
            protocol: parsedUrl.protocol ? parsedUrl.protocol : "https",
            host: parsedUrl.host,
            port: parsedUrl.port ? parsedUrl.port : "443",
            username: request.params.username,
            password: request.params.password,
            apiVersion,
        });
    }
}
exports.JiraAction = JiraAction;
Hub.addAction(new JiraAction());
