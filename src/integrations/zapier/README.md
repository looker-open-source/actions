# Zapier

This integration allows you to send data directly to a Zapier Zap. The data format received by Zapier will be the `json_detail` format, which has a lot of interesting metadata ([example here](https://github.com/looker/integrations/docs/json_detail_example.json)). Build out your Zap using Looker data!

1. Go to your Zapier [home page](https://zapier.com/app/explore).

![](zapier\ home.png)

2. Create Zap.

![](zapier\ webhook.png)

3. Select Webhook Trigger and select Catch Hook.

![](zapier\ webhook\ url.png)

4. Copy Webhook URL.

5. Enable Zapier  in your in your looker Administration page for integrations (/admin/integrations).

6. Use the copied webhook URL in Send or Schedule to Zapier.
