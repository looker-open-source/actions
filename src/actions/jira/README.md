# JIRA
## Create a JIRA issue referencing data

This action will create a JIRA Issue referencing data from a Look. You will first create a LookerBot user so that the creator of an issue is clear. You will then be able to create issues in any JIRA project that the LookerBot has access to referencing a Look.

1. Create a lookerbot user in your JIRA user [administration console](https://MYJIRA.atlassian.net/admin/users). Take note of the username and password you give to the lookerbot.

2. Enable JIRA in your looker Administration page for actions (/admin/actions).

* Address is the url of your JIRA server: e.g. https://MYJIRA.atlassian.net
* username of the lookerbot user
* password of the lookerbot user

## JIRA Action Oauth Setup

1. Create a JIRA account or use the account you want your action hub tickets to be associated with.
2. Navigate to the Atlassian developer console https://developer.atlassian.com/console/myapps/
3. Click the create button to create an “OAUTH 2.0 Integration” 
[OAUTH 2.0 Integration](./readmeImages/oAuthStep3.png)
4. Name your app and agree to the terms
[Name your app](./readmeImages/oAuthStep4.png)
5. Click on the “Distribution” tab then the “Edit” button. Then make sure your app’s “Distribution Status” are set to “Not Sharing”. Save your changes.
6. Click on the “Permissions” tab. 
7. Click “Add” or “Configure” for “User Identity API”. Click “Edit Scopes” and select “View active user profile”
8. Click “Add” or “Configure” for “Jira API”. Click “Edit Scopes” and select “View Jira issue data”, “View user profiles”, and “Create and manage issues”
9. Click “Add” or “Configure” for “Personal data reporting API”. Click “Edit Scopes” and select “Personal data reporting API”
10. Click the “Authorization” tab. Click “Add” or “Configure” for “OAuth 2.0 (3LO)”
11. Enter your callback url for your action hub. ie. https://your_https_web_hosted_address.com/actions/jira_create_issue/oauth_redirect
12. Make sure all changes have been saved. Then click on the “Settings” tab and scroll to “Authentication Details”. Here you have your app’s client id and secret.
13. Copy and paste the client id and secret into the .env file in your local action hub repo.
`JIRA_CLIENT_ID=client id`
`JIRA_CLIENT_SECRET=secret`

