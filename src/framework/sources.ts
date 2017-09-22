import { Integration } from "./integration"

const integrations: Integration[] = []

export function addIntegration(integration: Integration) {
  integrations.push(integration)
}

export async function allIntegrations() {
  const whitelistNames = process.env.INTEGRATION_WHITELIST
  if (typeof whitelistNames === "string" && whitelistNames.length > 0) {
    const whitelist = whitelistNames.split(",")
    return integrations.filter((i) => whitelist.indexOf(i.name) !== -1)
  } else {
    return integrations
  }
}

export async function findDestination(id: string) {
  const all = await allIntegrations()
  const integration = all.filter((i) => i.name === id)[0]
  if (!integration) {
    throw "No integration found."
  }
  return integration
}
