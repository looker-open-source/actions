import  { DestinationSource } from './destination_source';
import  { Destination } from './destination';

// Sources
import { TestDestinationSource } from "./destination_sources/test_source";

export function allSources() : DestinationSource[] {
  return [
    new TestDestinationSource()
  ];
}

export function allDestinations() : Promise<Destination[]>  {
  return new Promise<Destination[]>((resolve, reject) => {
    let srcPromises = allSources().map((src) => { return src.sourcedDestinations() });
    var prom = Promise.all(srcPromises).then((all) => {
      resolve(all.reduce((a, b) => { return a.concat(b); }, []));
    });
  });
}

export function findDestination(id : string) : Promise<Destination> {
  return new Promise((resolve, reject) => {
    allDestinations().then((destinations) => {
      let dest = destinations.filter((d) => {
        return d.id == id;
      })[0];
      if (dest) {
        resolve(dest);
      } else {
        reject(`No destination with id "${id}".`);
      }
    });
  });
}

