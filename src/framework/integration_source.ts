import  { Integration } from "./integration";

export abstract class IntegrationSource {

  public abstract async sourcedIntegrations(): Promise<Integration[]>;

}
