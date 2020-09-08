# Adding Actions

We've tried to make it as simple as possible to add a new action to Looker's official Action Hub.

The service is a [Node.js](https://nodejs.org/) server written in [TypeScript](https://www.typescriptlang.org/).

If you're not familiar with [TypeScript](https://www.typescriptlang.org/) it is a small layer on top of modern JavaScript that adds type information to help catch programming errors faster. If you're familiar with JavaScript, most of the language should be familiar to you.

The project is written with the most current JavaScript style and features (currently [ES2015](https://en.wikipedia.org/wiki/ECMAScript#History)) to help improve code clarity and expressiveness.

## Requirements

To get started contributing a service you'll need to install:

- [Node.js](https://nodejs.org/)

   The project is set up to use [nvm](https://github.com/creationix/nvm) to select the proper Node.js version.
   You can also use [nodenv](https://github.com/nodenv/nodenv) with the [package-json-engine](https://github.com/nodenv/nodenv-package-json-engine) plugin.

- [Yarn](https://yarnpkg.com/en/)

Be sure to review the [official Action Hub docs](https://docs.looker.com/sharing-and-publishing/action-hub) before diving in to the details here.


## Overview

Currently there are three "levels" to which an action can apply in Looker – `cell`, `query`, and `dashboard`. These values correspond to the `supported_action_types` of an action. For example, the [Segment action](https://github.com/looker/actions/blob/master/src/actions/segment/segment.ts) is query level, which means it will be available from the Send and Schedule menus. (In the future there may be other ways to operate on a query in Looker, but the idea is that the action shouldn't need to do anything differently to support that). The [Twilio Message action](https://github.com/looker/actions/blob/master/src/actions/twilio/twilio_message.ts) is a `cell` level action so it appears via the "..." menu append to each cell's data in the result table. Cell level actions are essentially the same as the existing [LookML "data action"](https://discourse.looker.com/t/data-actions/3573), but provided via the action API. These actions need to specify tag information in their `requiredFields` property, and the relevant fields need to be tagged via the [LookML `tags` parameter](https://docs.looker.com/reference/field-params/tags). The [SendGrid action](https://github.com/looker/actions/blob/master/src/actions/sendgrid/sendgrid.ts) is a dashboard level action. These actions support receiving an full dashboard image. An action can support multiple types if needed.

When actions are enabled in the Looker instance they can be given global config values indicated by the [`params`](https://github.com/looker/actions/blob/master/src/actions/segment/segment.ts#L41) property in the action definition. This is useful for settings like client_id or bucket name. The settings can also be bound to a particular [user attribute](https://discourse.looker.com/t/user-attributes/3979), which will dynamically substitute the value of that attribute at runtime. This is useful for providing settings at the group or individual user level, without exposing the values to end users.

A design requirement for our action server is to be completely stateless, so storing any information in the action application is not allowed. Any information needed to fulfill the action must be provided along with the action payload. Params allow us to accomplish this by keeping all state and credentials in Looker.

Regarding the format of the data payload, the [ActionRequest class](https://github.com/looker/actions/blob/master/src/hub/action_request.ts#L65) defines all data that will be available for the action to work with (it also supplies sevel helper functions). For `query` type actions, the request will contain an `attachment` that can be in [many formats](https://github.com/looker/actions/blob/master/src/api_types/integration.ts#L17). The action can specify particular `supportedFormats` (including just a single one) and work with that data how it pleases. The most verbose one is the `json_detail` format, which contains copious metadata typically used by the Looker frontend ([example here](https://github.com/looker/actions/blob/master/docs/json_detail_example.json)). But, you can also pick CSV or Excel or let the user decide the format.

For complete testing, you'll probably want to try your action in a real Looker instance. You can do this by visiting `/admin/actions?edit=true` in your instance, then scrolling to the buttom and pressing the "Add Action Hub" button. Input the URL and Authorization token (ACTION_HUB_SECRET) of your development server. This server will need to be accessible from the Looker host and use a valid SSL certificate, so [deploying to a service like Heroku](https://github.com/looker/actions/blob/master/docs/deploying.md) can help keep things simple.

## Running an Action Hub service locally:

Clone this repo and install dependencies. If you are familiar with GitHub, you may wish to create your own fork of the repo first, and do your development in a new branch.

    git clone git@github.com:looker/actions.git
    git checkout -b my_new_branch
    yarn install

Create a config file based on the provided example. You can change the values as needed but the defaults are sufficient for development.

    cp .env.example .env 

Start the service. This uses `nodemon` which automatically restarts the server when you make code changes.

    yarn dev

If all goes well you will see a message saying the Action Hub is listening. You can confirm this by visiting the base_url:port in your web browser to see a status page.

## Add a new action:

1. Write a new action in `src/actions/my_actions_group/my_action.ts`. 

    We recommend using the existing code as a guide. Many common use cases already have examples in the repository. The [Action API docs](https://github.com/looker/actions/blob/master/docs/action_api.md) are also a useful reference.

1. If your action code uses dependencies from npm not yet included in the project (such as API client SDKs), add those to the package.json with:

    yarn add my-action-dependency

1. Add an icon to `src/actions/my_actions_group/my_action.svg`
1. Add the action to `src/actions/index.ts`

    `import "./my_actions_group/my_action.ts"`

1. Add a test to `src/actions/my_actions_group/test_my_action.ts`
1. Add the test to `test/actions/test.ts`

    `import "../src/actions/my_actions_group/my_action"`

1. Add a README.md to `src/actions/my_actions_group` explaining the purpose and means for authentication. Screenshots can be helpful.

1. Run tests with `yarn test`

As discussed above, you can attach your custom Action Hub server to a Looker instance in order to fully test the new action in the Looker UI. Note however that Looker requires a trusted HTTPS connection to Action Hub. You can temporarily modify the framework server code to implement this (advanced), or set up a reverse proxy such as nginx or [ssl-proxy](https://github.com/suyashkumar/ssl-proxy), or [deploy to a service like Heroku](https://github.com/looker/actions/blob/master/docs/deploying.md) or your own corporate infrastructure.

## Submit a PR

After your action has been tested, you can submit a PR to the `looker/actions` repo in GitHub.

    git push <your fork> <your development branch>

Then create your pull request with the [looker/actions repo](https://github.com/looker/actions) as your target.

Looker will review your action code. Looker reserves the right to decline your PR, but can help you with any issues you have and offer suggestions for improvement. Looker then merges the code into the looker/actions repo and deploys it to actions.looker.com. Once deployed, it will become available to everyone who uses Looker.

More information about publishing actions or deploying a private Action Hub for production use is available here: https://docs.looker.com/sharing-and-publishing/action-hub

Please don't hesitate to reach out to Looker Support or your Success team contacts with questions about action development.
