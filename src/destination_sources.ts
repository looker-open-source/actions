import  { DestinationSource } from './destination_source';
import  { Destination } from './destination';

// Sources
import { TestDestinationSource } from "./destination_sources/test_source";

export function allSources() : DestinationSource[] {
  return [
    new TestDestinationSource()
  ];
}

export async function allDestinations() {
  let srcPromises = allSources().map((src) => { return src.sourcedDestinations() });
  var all = await Promise.all(srcPromises);
  return all.reduce((a, b) => {
    return a.concat(b);
   }, []);
}

export async function findDestination(id : string) {
  let destinations = await allDestinations();
  let dest = destinations.filter((d) => {
    return d.id == id;
  })[0];
  if (!dest) {
    throw "No destination found.";
  }
  return dest;
}
