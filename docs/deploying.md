## Running an Action Hub on Cloud Run

Because Looker will only accept an action hub with a valid HTTPS certificate, it is convenient to run the Action Hub on Cloud Run, which provides ways to both serve TLS and autoscale your custom action deployment
First ensure you can use the gcloud cli, which you can learn install [here](https://cloud.google.com/sdk/docs/install)

With the gcloud cli installed, you can create a build and deploy for your GCP project through the following command
```bash
gcloud builds submit --config=cloudbuild_container.yaml --project=YOUR_PROJECT
```
You can view the cloudbuild status [here](https://pantheon.corp.google.com/cloud-build/builds).
You can view the status of your deployment [here](https://pantheon.corp.google.com/run/detail/us-central1/actionhub) if the build correctly worked.

### Environment variables
In the revisions page you will need to set the following environment variables at minimum for the actionhub to work. Some actions may require more environment settings to work.
ACTION_HUB_LABEL=YourHubName
ACTION_HUB_SECRET=YOURSECRET
ACTION_HUB_BASE_URL=<CLOUDRUN_URL>

#### Adding the Action Hub to Looker

Make sure your action hub is running. You will then need to run the following command locally:

    yarn generate-api-key

You can locally run this command as long as the secret key is set and the same as the one used in Cloud Run.

Save the value that is returned and then navigate to the actions admin page on a Looker instance or go directly to:

    https://my-looker.looker.com/admin/actions?edit=true

There, add the URL for your action hub and enter the token returned by `yarn generate-api-key` above. You should see a list of actions supported by your hub.

#### Testing your Action

Within Looker, [create and save](https://docs.looker.com/exploring-data/saving-and-editing-looks) a Look.

On the saved Look, [schedule](https://docs.looker.com/sharing-and-publishing/emails-and-alerts) a data delivery and select my-action in the Destination select.

If you have a form for delivery, the UI will render it here. Send Test will deliver the data.

In the event of an error, an email will be sent to the Looker user with any error message from the action hub.

