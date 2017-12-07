# Zapier
## Send data and begin a Zapier zap.

This action allows you to send data directly to a Zapier Zap. The data format received by Zapier will be the `json_detail` format, which has a lot of interesting metadata ([example here](https://github.com/looker/actions/docs/json_detail_example.json)). Build out your Zap using Looker data!

1. Go to your Zapier [home page](https://zapier.com/app/explore).

![](zapier&#32;home.png)

2. Create Zap.

![](zapier&#32;webhook.png)

3. Select Webhook Trigger and select Catch Hook.

![](zapier&#32;webhook&#32;url.png)

4. Copy Webhook URL.

5. Enable Zapier  in your in your looker Administration page for actions (/admin/actions).

6. Use the copied webhook URL in Send or Schedule to Zapier.
