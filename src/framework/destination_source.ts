import  { Destination } from "./destination";

export abstract class DestinationSource {

  public abstract async sourcedDestinations(): Promise<Destination[]>;

}
