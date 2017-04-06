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

