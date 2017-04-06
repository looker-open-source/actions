import  { Promise } from 'es6-promise';
import  { Destination } from './destination';

export abstract class DestinationSource {

  abstract sourcedDestinations() : Promise<Destination[]>;

}
