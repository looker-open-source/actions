# Tray.ai

**This is not an officially supported Google product.**

## Send Looker data to a Tray.ai workflow and start it.

This action sends Looker data directly to a Tray.ai workflow. Tray.ai receives the data in the `json_detail` format, which includes query metadata ([example here](https://github.com/looker/actions/docs/json_detail_example.json)). Use the Looker data in any workflow step. Tray iPaaS connects 700+ enterprise systems and adds AI to any workflow step.

1. Sign in to [Tray.ai](https://app.tray.io/) and create a new workflow.
2. Choose **Webhook** as the trigger. The **Auto respond with HTTP 200** operation is enough for this action.
3. Open the trigger step options and select **Copy public URL**.
4. Enable Tray.ai on your Looker Administration page for actions (`/admin/actions`).
5. In Looker, choose **Send** or **Schedule**, select Tray.ai and paste the copied URL.

To restrict who can start the workflow, set a CSRF token in the trigger's advanced properties. For screenshots and all trigger options, see the [Webhook trigger documentation](https://tray.ai/documentation/connectors/trigger/webhook-trigger).
