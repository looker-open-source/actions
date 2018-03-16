## Adding Actions

We've tried to make it as simple as possible to add a new action to Looker's official Action Hub.

The service is a [Node.js](https://nodejs.org/) server written in [TypeScript](https://www.typescriptlang.org/).

If you're not familiar with [TypeScript](https://www.typescriptlang.org/) it's a small layer on top of modern JavaScript that adds type information to help catch programming errors faster. If you're familiar with JavaScript, most of the language should be familiar to you.

The project is written with the most current JavaScript style and features (currently [ES2015](https://en.wikipedia.org/wiki/ECMAScript#History)) to help improve code clarity and expressiveness.

#### Requirements

To get started contributing a service you'll need to install:

- [Node.js](https://nodejs.org/)

   The project is set up to use [NVM](https://github.com/creationix/nvm) to select the proper Node.js version.

- [Yarn](https://yarnpkg.com/en/)

When you've got those installed on your machine, run `yarn install` to install all the dependencies.

## Developing a new Action

Currently there are three places (`types`) of actions – `query`, `cell` and `dashboard` level. The [Segment action](https://github.com/looker/actions/blob/master/src/actions/segment/segment.ts) is query level, which means it will attach to the scheduler. In the future, these will be able to attach to queries in Looker in other ways, but the action shouldn't need to do anything differently to support that. The [Twilio Message action](https://github.com/looker/actions/blob/master/src/actions/twilio/twilio_message.ts) is a `cell` level action and appears in Looker by adding a "..." to the end of each cell's data in the result table. Cell level actions are essentially the same as our [existing "data actions"](https://discourse.looker.com/t/data-actions/3573), but provided via the action API. These actions will need to specify tag information in `requiredFields` and the relevant fields need to be tagged in some way via the [LookML `tags` parameter](https://docs.looker.com/reference/field-params/tags). The [SendGrid action](https://github.com/looker/actions/blob/master/src/actions/sendgrid/sendgrid.ts) is a dashboard level action. These actions support receiving an full dashboard image. An action can also choose to hook into multiple types of actions if need be.

To pass information about Looker users to the action, you should specify [a `param`](https://github.com/looker/actions/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/actions/segment.ts#L18-L26) in the action definition. When setting up the action in Looker, the Looker administrator can choose to either type a value for the parameter or bind the value of the parameter to a particular User Attribute, which can be configured to provide whatever information you like on a per-user (or group) level.

A design requirement for our action server is being completely stateless, so storing any information in the action application is not allowed. Any information needed to fulfill the action must be provided along with the action payload. Params (optionally fulfilled by [user attributes](https://discourse.looker.com/t/user-attributes/3979)) should let us do pretty much whatever we need while keeping all the state and credentials in Looker.

Regarding the format of the data payload, the [ActionRequest class](https://github.com/looker/actions/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/framework/data_action_request.ts#L37) defines everything that's available for the action to work with. For `query` type actions, the request will contain an `attachment` that can be in [many formats](https://github.com/looker/actions/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/framework/data_action_request.ts#L9-L19). The action can specify particular `supportedFormats` (including just a single one) and work with that data how it pleases. The most useful one, which the Segment action uses, is the `json_detail` format, which has a lot of interesting metadata ([example here](https://github.com/looker/actions/blob/master/docs/json_detail_example.json)). But remember, you can also pick CSV or Excel or let the user decide the format.)

For complete testing, you'll probably want to try your action against a real Looker instance. For this phase, the way to do that is to go to the Looker instance route `/admin/actions?edit=true` and add a new "action Hub" URL representing your development server. (This server will need to be on the public internet with a valid SSL certificate, so deploying to Heroku is the easiest choice since you get that out of the box there.)

## Running a action service:

Clone and run the action service locally

    git clone git@github.com:looker/actions.git
    cd actions
    yarn install
    yarn dev

#### Add a new action:

Add any dependencies

    yarn add my-action-sdk

1. Write a new action in src/actions/my_action/my_action.ts
1. Add an icon to src/actions/my_action/my_action.svg
1. Add the action to src/actions/index.ts

    `import "./my_action/my_action.ts"`

1. Add a test to src/actions/my_action/test_my_action.ts
1. Add a test to test/actions/test.ts

    `import "./actions/test_my_action"`

1. Add a README.md to src/actions/my_action explaining the purpose and means for authentication. Screenshots can be helpful.

1. To run tests `yarn test`

You can get a development server running with `yarn dev` per the instructions below. 
