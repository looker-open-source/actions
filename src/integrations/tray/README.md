# Tray

This integration allows you to send data directly to a Tray workflow. The data format received by Tray will be the `json_detail` format, which has a lot of interesting metadata ([example here](https://github.com/looker/integrations/docs/json_detail_example.json)). Build out your Workflow using Looker data!

1. Go to your Tray [home page](https://tray.io/dashboard).

![](tray home.png)

2. Select Create Workflow.

![](tray webhook.png)

3. Select Add Webhook Connector.

![](tray webhook url.png)

4. Select the Far right Settings Gear -> Copy Workflow Public URL.

5. Enable Tray in your in your looker Administration page for integrations (/admin/integrations).

6. Use the copied webhook URL in Send or Schedule to Tray.
