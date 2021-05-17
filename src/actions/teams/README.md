# Microsoft Teams - Incoming Webhook

## Send message from a Look to Microsoft Teams using incoming webhook

The Microsoft Teams Action allow you to send message from looker to Teams channel via incoming webhook. By entering the incoming webhook endpoint, card title, and body in the form, the message will be sent like a bot in Teams.（also, you can attache metadata of Look/Explore/Dashboard）

1. Create an incoming webhook in Teams.

   ![image1](Teams&#32;Console.png)

2. Copy the generated URL

3. Enable Teams Action in your looker Administration page for actions (/admin/actions).

4. When executing the action, enter the URL copied in step 2, the title and body of the message you want to send, and post it to the Teams channel. (You can also attach metadata with the option).

   ![image2](Teams&#32;Action&#32;Form.png)
