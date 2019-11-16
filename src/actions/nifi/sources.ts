import { Integration } from "./integration"

const integrations: Integration[] = []

export function addIntegration(integration: Integration) {
  integrations.push(integration)
}

export async function allIntegrations() {
  return integrations
}

export async function findDestination(id: string) {
  const all = await allIntegrations()
  const integration = all.filter((i) => i.name === id)[0]
  if (!integration) {
    throw "No destination found."
  }
  return integration
}
