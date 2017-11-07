# Looker Integration Service

This service provides a stateless server that implements Looker's Integration API and exposes popular integrations.

Looker hosts a version of this service for you, but it's open source so you can contribute additional integrations or host an instance of the service within your own infrastructure.

## 3 Ways to Build Integrations

There are a couple of ways to contribute integrations for Looker:

1. Add an action to Looker's official hub

  This is the easiest approach and is perfect for any action that you'd like to make available to everyone. It requires some familiarity with Node.js programming.

  We'll review your action code, merge it into our official hub, and deploy it to our cloud service. Once deployed, it will become available to everyone who uses Looker.

  [Guide to contributing an action &rarr;](docs/adding_actions.md)

2. Create and deploy your own hub with our Node.js framework

  If you have actions that are private to your company or use case, adding an integration to the official hub isn't appropriate. You can use the same Node.js framework we use for our official hub to create your own hub with your own custom actions.

  You'll then deploy your internal hub on your own server or using a cloud-based application platform like [Heroku](https://www.heroku.com/).

  [Copy and deploy our template Node application](https://github.com/looker/custom-action-hub-example)

3. Implement Looker's RESTful Integration API into any web server

  If you'd like to build your integration directly into an existing web service, or you'd prefer to build your hub in a language of your choosing, you can easily have your server implement our Integration API directly.

  The Integration API is a simple webhook-like API to accept actions from Looker. The above integration options are based on this same API.

## Issues and Requests

Head over to [the issue tracker](https://github.com/looker/integrations/issues) to report a bug or requst a feature for our official action hub.

## On-Premise Deployment

Most users should our official action hub cloud service. By default, that's what Looker will use to provide actions. The action hub works whether your Looker instance is hosted by us or on-premise. If you'd like to deploy a copy of the same integrations within your own infrastructure, you can do so by deploying this repository yourself, and adding it to Looker as a new hub.

[Deployment instructions &rarr;]
