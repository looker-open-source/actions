# Looker Integration Service

This service provides a stateless server that implements Looker's Integration API and exposes popular integrations.

Looker hosts a version of this service for you, but it's open source so you can contribute additional integrations or host an instance of the service within your own infrastructure.

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

Currently there are two places (`types`) of integrations – `query` level and `cell` level. The [Segment integration](https://github.com/looker/integrations/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/integrations/segment.ts#L27) is query level, which means it will attach to the scheduler. In the future, these will be able to attach to queries in Looker in other ways, but the integration shouldn't need to do anything differently to support that. A `cell` level integration will appear in Looker by adding a "..." to the end of each cell's data in the result table. Cell level integrations are essentially the same as our [existing "data actions"](https://discourse.looker.com/t/data-actions/3573), but provided via the integration API. These integrations will need to specify tag information in `requiredFields` and the relevant fields need to be tagged in some way via the [LookML `tags` parameter](https://docs.looker.com/reference/field-params/tags). An integration can also choose to hook into both types of actions if need be.

To pass information about Looker users to the integration, you should specify [a `param`](https://github.com/looker/integrations/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/integrations/segment.ts#L18-L26) in the integration definition. When setting up the integration in Looker, the Looker administrator can choose to either type a value for the parameter or bind the value of the parameter to a particular User Attribute, which can be configured to provide whatever information you like on a per-user (or group) level.

A design requirement for our integration server is being completely stateless, so storing any information in the integration application is not allowed. Any information needed to fulfill the integration must be provided along with the action payload. Params (optionally fulfilled by [user attributes](https://discourse.looker.com/t/user-attributes/3979)) should let us do pretty much whatever we need while keeping all the state and credentials in Looker.

Regarding the format of the data payload, the [DataActionRequest class](https://github.com/looker/integrations/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/framework/data_action_request.ts#L37) defines everything that's available for the integration to work with. For `query` type integrations, the request will contain an `attachment` that can be in [many formats](https://github.com/looker/integrations/blob/fd4ce4e63f44554c7257584df380f8a4e4adfc03/src/framework/data_action_request.ts#L9-L19). The integration can specify particular `supportedFormats` (including just a single one) and work with that data how it pleases. The most useful one, which the Segment integration uses, is the `json_detail` format, which has a lot of interesting metadata ([example here](https://github.com/looker/integrations/docs/json_detail_example.json)). But remember, you can also pick CSV or Excel or let the user decide the format.)

For complete testing, you'll probably want to try your integration against a real Looker instance. For this pre-release phase, the way to do that is to go to the Looker instance route /admin/integrations?edit=true and add a new "Integration Hub" URL representing your development server. (This server will need to be on the public internet with a valid SSL certificate, so deploying to Heroku is the easiest choice since you get that out of the box there.)

## Running a integration service:

Clone and run the integration service locally

    git clone git@github.com:looker/integrations.git
    cd integrations
    yarn install
    yarn dev

#### Add a new integration:

Add any dependencies

    yarn add my-integration-sdk

Write a new integration in src/integrations/my_integration.ts
Add an icon to src/integrations/icons/my_integration.svg
Add the integration to src/integrations/index.ts

    import "./my_integration.ts"

Add a test to test/integrations/test_my_integration.ts
Add a test to test/integrations/test.ts
    import "./integrations/test_my_integration"

To run tests `yarn test`

You can get a development server running with `yarn dev` per the instructions below. Because Looker requires that your integration server has a valid SSL certificate, we highly recommend using a service like Heroku for development (helpful instructions below).

    export BASE_URL="https://my-integration-service.heroku.com";
    export INTEGRATION_PROVIDER_LABEL="My Company";
    export INTEGRATION_SERVICE_SECRET="my-secret";
    yarn dev

## Running an Integration Service w/Heroku

Because Looker will only accept an integration server with a valid HTTPS certificate, it is convenient to develop with Heroku Really! It's super convenient and fast! Just as snappy as running locally. Here are some instructions to get you started:

* create an account with Heroku if you don't already have one
* run `heroku login` and provide your Heroku credentials
* `cd` into the `integrations` directory and run:
   * `heroku create`
   * `git push heroku master`
   * `heroku config:set BASE_URL="https://my-heroku-integration-server-1234.herokuapp.com"` — use the URL for your Heroku application that was mentioned after running `git push heroku master` above
   * `heroku config:set INTEGRATION_PROVIDER_LABEL="Awesome Integration Service"
   * `heroku config:set INTEGRATION_SERVICE_SECRET="<my-secret>"`

You can test that the integration server is running by going to your Heroku application URL. If you need to view logs at any time, you can run:

   heroku logs

#### To add the integration service to a Looker

my-looker.looker.com/admin/integrations?edit=true

Add Integration Hub

https://my-integration-service.heroku.com

You should see a list of integrations supported by your service.

Enable my-integration

Within Looker, [create and save](https://docs.looker.com/exploring-data/saving-and-editing-looks) a Look.

On the saved Look, [schedule](https://docs.looker.com/sharing-and-publishing/emails-and-alerts) a data delivery and select my-integration in the Destination select.

If you have a form for delivery, the UI will render it here. Send Test will deliver the data.

In the event of an error, an email will be sent to the Looker user with any error message from the integration service.

