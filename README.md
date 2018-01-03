# Looker Action Hub

Looker hosts and provides a stateless server that implements Looker's Action API and exposes popular actions. A full list of actions provided by default within the Looker App can be referenced on our [Docs Page](https://docs.looker.com/r/admin/action-hub).

Our service is open source so you can contribute additional actions or host an instance of the service within your own infrastructure.

## 3 Ways to Build Actions

There are a couple of ways to contribute actions for Looker:

1. Add an action to Looker's official Hub

   This is the easiest approach and is perfect for any action that you'd like to make available to everyone. It requires some familiarity with Node.js programming.

   We'll review your action code, merge it into our official hub, and deploy it to our cloud service. Once deployed, it will become available to everyone who uses Looker.

   [Guide to contributing an action &rarr;](docs/adding_actions.md)

2. Create and deploy your own hub with our Node.js framework

   If you have actions that are private to your company or use case, adding an action to the official hub isn't appropriate. You can use the same Node.js framework we use for our official hub to create your own hub with your own custom actions.

   You'll then deploy your internal hub on your own server or using a cloud-based application platform like [Heroku](https://www.heroku.com/).

   [Copy and deploy our template Node application &rarr;](https://github.com/looker/custom-action-hub-example)

3. Implement Looker's RESTful Action API into any web server

   If you'd like to build your action directly into an existing web service, or you'd prefer to build your hub in a language of your choosing, you can easily have your server implement our Action API directly.

   The Action API is a simple webhook-like API to accept actions from Looker. The above action options are based on this same API.

   [Action API Guide &rarr;](docs/action_api.md)

## Issues and Requests

Head over to [the issue tracker](https://github.com/looker/actions/issues) to report a bug or requst a feature for our official action hub.

## On-Premise Deployment

Most users should use our official action hub cloud service running on (https://actions.looker.com/). By default, that's what Looker will use to provide actions. The action hub works whether your Looker instance is hosted by us or on-premise. If you'd like to deploy a copy of the same actions within your own infrastructure, you can do so by deploying this repository yourself, and adding it to Looker as a new hub.

[Deployment instructions &rarr;](docs/deploying.md)
