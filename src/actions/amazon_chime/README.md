![Image result for amazon chime](./amazon_chime_full.png)


## Send markdown tables from Looker queries to Amazon Chime via webhooks.
Take a Looker explore or look, and send the data to Amazon Chime through its [webhook integration](https://docs.aws.amazon.com/chime/latest/ug/webhooks.html). You can send data to team members or create real time alerts as data is being analyzed in Looker.

## Setup
While in a Chime chat room, administrators of the chat room have the ability to add a webhook through the `Manage webhooks and bots` settings options. To set up this integration follow these steps:

 1. `Add webhook` through the `Manage webhooks and bots` modal for a chat room
 2. Add a name for the bot (e.g., `New Alert Bot`)
 3. Copy URL for the bot
 4. Open up your Looker actions settings; https://yourlooker.looker.com/admin/actions
 5. Enable the Amazon Chime action (if you don't see it, press Refresh at the top of the page under for Looker Action Hub
 6. On the Chime Action page, enable it and paste the webhook url in the Webhook box and press Save.

## Test the Chime Integration

 1. Open up a Looker explore and create a quick table by selecting dimensions and/or measures
 2. In the gear icon in the top right of the window, click `Send` 
 3. Add a Title, select Chime Table, then press Send.
 4. Check the Chime chat room that the webhook URL is associated with

## Chime Table Features

 - Takes the table visualization from a Look or Explore and creates a markdown table to send to Amazon Chime
 - Amazon Chime has a 4kb payload limit, so if there is too much data, this action will only send data that will fit in that payload.
 - Given this limit, the table may be truncated, in which case this action will give you the number of rows shown versus action and give you a link to see the data in Looker
 - Drill links may also be exposed while sending the table. When scheduling the Chime Action, you can choose if you want to include all, the first, or no drill links. This will affect the size of the payload and how much data you can send to Amazon Chime
 - The Title can also be sent as part of the integration; this will also include a link back to the original Looker / query in Looker

 
