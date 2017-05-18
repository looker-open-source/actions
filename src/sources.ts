import * as D from "./framework";
import * as index from "./integrations/index";

export function allSources(): D.IntegrationSource[] {
  return index.allSources();
}

export async function allDestinations() {
  let srcPromises = allSources().map((src) => { return src.sourcedIntegrations(); });
  let all = await Promise.all(srcPromises);
  return all.reduce((a, b) => {
    return a.concat(b);
   }, []);
}

export async function findDestination(id: string) {
  let destinations = await allDestinations();
  let dest = destinations.filter((d) => {
    return d.name === id;
  })[0];
  if (!dest) {
    throw "No destination found.";
  }
  return dest;
}
