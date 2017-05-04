import * as D from "./framework";

// Sources
import { DropboxSource } from "./sources/dropbox";
import { GitHubSource } from "./sources/github";
import { GoogleDriveSource } from "./sources/google_drive";
import { SegmentSource } from "./sources/segment";

export function allSources(): D.DestinationSource[] {
  return [
    new DropboxSource(),
    new SegmentSource(),
    new GitHubSource(),
    new GoogleDriveSource(),
  ];
}

export async function allDestinations() {
  let srcPromises = allSources().map((src) => { return src.sourcedDestinations(); });
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
