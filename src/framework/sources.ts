import { IIntegration, Integration } from "./integration";

const integrations: Integration[] = [];

export function addIntegration(integration: IIntegration) {
  integrations.push(new Integration(integration));
}

export async function allIntegrations() {
  return integrations;
}

export async function findDestination(id: string) {
  let all = await allIntegrations();
  let integration = all.filter((i) => i.name === id)[0];
  if (!integration) {
    throw "No destination found.";
  }
  return integration;
}
