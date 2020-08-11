## Running an Action Hub on Heroku

Because Looker will only accept an action hub with a valid HTTPS certificate, it is convenient to develop with Heroku. Really! It's super convenient and fast! Just as snappy as running locally. Here are some instructions to get you started:

* Create an account with Heroku if you don't already have one
* Run `heroku login` and provide your Heroku credentials
* `cd` into the project folder and run:
   * `heroku create`
   * `git push heroku master`
   * `heroku config:set ACTION_HUB_BASE_URL="https://my-heroku-action-server-1234.herokuapp.com"`
      
      Use the URL for your Heroku application that was mentioned after running `git push heroku master` above
   * `heroku config:set ACTION_HUB_LABEL="Awesome Action Hub"`
   * `heroku config:set ACTION_HUB_SECRET="<my-secret>"`

We recommend that you work on features using a branch. To create and push a branch to Heroku:

* `git checkout -b my-name/my-awesome-feature` 
   
   This creates a branch called `my-name/my-awesome-feature` and switches to it
* `git push heroku my-name/my-awesome-feature:master`

   This pushes your branch to Heroku and runs it

You can test that the action hub is running by going to your Heroku application URL. If you need to view logs at any time, you can run:

    heroku logs

If at some point you forget the URL of your Heroku server, you can run:

    heroku info -s | grep web_url

#### Adding the Action Hub to Looker

Make sure your action hub is running. You will then need to run the following command on the server that is running the action hub:

    yarn generate-api-key

Note that if you are using Heroku, you can run this command on your dyno by running `heroku run yarn generate-api-key`.

Save the value that is returned and then navigate to the actions admin page on a Looker instance or go directly to:

    https://my-looker.looker.com/admin/actions?edit=true

There, add the URL for your action hub and enter the token returned by `yarn generate-api-key` above. You should see a list of actions supported by your hub.

#### Testing your Action

Within Looker, [create and save](https://docs.looker.com/exploring-data/saving-and-editing-looks) a Look.

On the saved Look, [schedule](https://docs.looker.com/sharing-and-publishing/emails-and-alerts) a data delivery and select my-action in the Destination select.

If you have a form for delivery, the UI will render it here. Send Test will deliver the data.

In the event of an error, an email will be sent to the Looker user with any error message from the action hub.

