
## Contributing

We're hoping that this project makes it really easy to contribute new integrations.

The service is a [Node.js](https://nodejs.org/) server written in [TypeScript](https://www.typescriptlang.org/).

If you're not familiar with [TypeScript](https://www.typescriptlang.org/) it's a small layer on top of modern JavaScript that adds type information to help catch programming errors faster. If you're familiar with JavaScript, most of the language should be familiar to you.

The project is written with the most current JavaScript style and features (currently [ES2015](https://en.wikipedia.org/wiki/ECMAScript#History)) to help improve code clarity and expressiveness.

#### Requirements

To get started contributing a service you'll need to install:

- [Node.js](https://nodejs.org/)

   The project is set up to use [NVM](https://github.com/creationix/nvm) to select the proper Node.js version.
- [Yarn](https://yarnpkg.com/en/)

When you've got those installed on your machine, run `yarn install` to install all the dependencies.

## Developing a new Integration

Currently there are three places (`types`) of integrations – `query`, `cell` and `dashboard` level. The [Segment integration](https://github.com/looker/integrations/blob/master/src/integrations/segment/segment.ts) is query level, which means it will attach to the scheduler. In the future, these will be able to attach to queries in Looker in other ways, but the integration shouldn't need to do anything differently to support that. The [Twilio Message integration](https://github.com/looker/integrations/blob/master/src/integrations/twilio/twilio_message.ts) is a `cell` level integration and appears in Looker by adding a "..." to the end of each cell's data in the result table. Cell level integrations are essentially the same as our [existing "data actions"](https://discourse.looker.com/t/data-actions/3573), but provided via the integration API. These integrations will need to specify tag information in `requiredFields` and the relevant fields need to be tagged in some way via the [LookML `tags` parameter](https://docs.looker.com/reference/field-params/tags). The [SendGrid integration](https://github.com/looker/integrations/blob/master/src/integrations/sendgrid/sendgrid.ts) is a dashboard level integration. These integrations support receiving an full dashboard image. An integration can also choose to hook into multiple types of actions if need be.

To pass information about Looker users to the integration, you should specify [a `param`](https://github.com/looker/integrations/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/integrations/segment.ts#L18-L26) in the integration definition. When setting up the integration in Looker, the Looker administrator can choose to either type a value for the parameter or bind the value of the parameter to a particular User Attribute, which can be configured to provide whatever information you like on a per-user (or group) level.

A design requirement for our integration server is being completely stateless, so storing any information in the integration application is not allowed. Any information needed to fulfill the integration must be provided along with the action payload. Params (optionally fulfilled by [user attributes](https://discourse.looker.com/t/user-attributes/3979)) should let us do pretty much whatever we need while keeping all the state and credentials in Looker.

Regarding the format of the data payload, the [ActionRequest class](https://github.com/looker/integrations/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/framework/data_action_request.ts#L37) defines everything that's available for the integration to work with. For `query` type integrations, the request will contain an `attachment` that can be in [many formats](https://github.com/looker/integrations/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/framework/data_action_request.ts#L9-L19). The integration can specify particular `supportedFormats` (including just a single one) and work with that data how it pleases. The most useful one, which the Segment integration uses, is the `json_detail` format, which has a lot of interesting metadata ([example here](https://github.com/looker/integrations/docs/json_detail_example.json)). But remember, you can also pick CSV or Excel or let the user decide the format.)

For complete testing, you'll probably want to try your integration against a real Looker instance. For this phase, the way to do that is to go to the Looker instance route `/admin/actions?edit=true` and add a new "Integration Hub" URL representing your development server. (This server will need to be on the public internet with a valid SSL certificate, so deploying to Heroku is the easiest choice since you get that out of the box there.)

## Running a integration service:

Clone and run the integration service locally

    git clone git@github.com:looker/integrations.git
    cd integrations
    yarn install
    yarn dev

#### Add a new integration:

Add any dependencies

    yarn add my-integration-sdk

1. Write a new integration in src/integrations/my_integration/my_integration.ts
1. Add an icon to src/integrations/my_integration/my_integration.svg
1. Add the integration to src/integrations/index.ts

    `import "./my_integration/my_integration.ts"`

1. Add a test to src/integrations/my_integration/test_my_integration.ts
1. Add a test to test/integrations/test.ts

    `import "./integrations/test_my_integration"`

1. Add a README.md to src/integrations/my_integration explaining the purpose and means for authentication. Screenshots can be helpful.

1. To run tests `yarn test`

You can get a development server running with `yarn dev` per the instructions below. Because Looker requires that your integration server has a valid SSL certificate, we highly recommend using a service like Heroku for development (helpful instructions below).

    export BASE_URL="https://my-integration-service.heroku.com";
    export INTEGRATION_PROVIDER_LABEL="My Company";
    export INTEGRATION_SERVICE_SECRET="my-secret";
    yarn dev

