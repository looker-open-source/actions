import  { Destination } from './destination';

export abstract class DestinationSource {

  abstract async sourcedDestinations() : Promise<Destination[]>;

}
