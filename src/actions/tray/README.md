# Tray
## Send data and begin a Tray workflow.

This action allows you to send data directly to a Tray workflow. The data format received by Tray will be the `json_detail` format, which has a lot of interesting metadata ([example here](https://github.com/looker/actions/docs/json_detail_example.json)). Build out your Workflow using Looker data!

1. Go to your Tray [home page](https://tray.io/dashboard).

![](tray&#32;home.png)

2. Select Create Workflow.

![](tray&#32;webhook.png)

3. Select Add Webhook Connector.

![](tray&#32;webhook&#32;url.png)

4. Select the Far right Settings Gear -> Copy Workflow Public URL.

5. Enable Tray in your in your looker Administration page for actions (/admin/actions).

6. Use the copied webhook URL in Send or Schedule to Tray.
