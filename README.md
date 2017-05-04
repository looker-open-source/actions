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

You can get a development server running with `yarn dev`.
