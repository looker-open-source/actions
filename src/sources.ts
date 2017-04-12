import * as D from "./framework";

// Sources
import { DropboxSource } from "./sources/dropbox";
import { SegmentSource } from "./sources/segment";

export function allSources() : D.DestinationSource[] {
  return [
    new DropboxSource(),
    new SegmentSource(),
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
    return d.name == id;
  })[0];
  if (!dest) {
    throw "No destination found.";
  }
  return dest;
}
