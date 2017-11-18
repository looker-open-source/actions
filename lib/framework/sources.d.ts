import { Integration } from "./integration";
export declare function addIntegration(integration: Integration): void;
export declare function allIntegrations(): Promise<Integration[]>;
export declare function findDestination(id: string): Promise<Integration>;
