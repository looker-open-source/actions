## Running an Integration Service w/Heroku

Because Looker will only accept an integration server with a valid HTTPS certificate, it is convenient to develop with Heroku. Really! It's super convenient and fast! Just as snappy as running locally. Here are some instructions to get you started:

* create an account with Heroku if you don't already have one
* run `heroku login` and provide your Heroku credentials
* `cd` into the `integrations` directory and run:
   * `heroku create`
   * `git push heroku master`
   * `heroku config:set BASE_URL="https://my-heroku-integration-server-1234.herokuapp.com"` — use the URL for your Heroku application that was mentioned after running `git push heroku master` above
   * `heroku config:set INTEGRATION_PROVIDER_LABEL="Awesome Integration Service`
   * `heroku config:set INTEGRATION_SERVICE_SECRET="<my-secret>"`

We recommend, per best practices, that you work on features using a branch. To create and push a branch to Heroku:

* `git checkout -b aryeh/my-awesome-feature` # creates a branch called `aryeh/my-awesome-feature` and switches to it
* `git push heroku aryeh/my-awesome-feature:master` # pushes your branch to Heroku and runs it

You can test that the integration server is running by going to your Heroku application URL. If you need to view logs at any time, you can run:

   heroku logs

If at some point you forget the URL of your Heroku server, you can run:

   heroku info -s | grep web_url

#### To add the integration service to a Looker

Make sure your integration server is running. You will then need to run the following command on the server that is running the integration server:

    yarn generate-api-key

Note that if you are using Heroku, you can run this command on your dyno by running `heroku run yarn generate-api-key`.

Save the value that is returned and then navigate to the integrations admin page on a Looker instance or go directly to:

    https://my-looker.looker.com/admin/actions?edit=true

There, add the URL for your integration server and enter the token returned by `yarn generate-api-key` above. You should see a list of integrations supported by your service.

Enable my-integration

Within Looker, [create and save](https://docs.looker.com/exploring-data/saving-and-editing-looks) a Look.

On the saved Look, [schedule](https://docs.looker.com/sharing-and-publishing/emails-and-alerts) a data delivery and select my-integration in the Destination select.

If you have a form for delivery, the UI will render it here. Send Test will deliver the data.

In the event of an error, an email will be sent to the Looker user with any error message from the integration service.

