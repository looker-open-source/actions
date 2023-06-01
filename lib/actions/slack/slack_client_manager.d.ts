import { WebClient } from "@slack/web-api";
import * as Hub from "../../hub";
export declare const PLACEHOLDER_WORKSPACE = "any";
export declare const MULTI_WORKSPACE_SUPPORTED_VERSION = "7.3.0";
export declare const isSupportMultiWorkspaces: (request: Hub.ActionRequest) => boolean | "" | null;
export declare const makeSlackClient: (token: string, disableRetries?: boolean) => WebClient;
export declare class SlackClientManager {
    private selectedInstallId;
    private clients;
    constructor(request: Hub.ActionRequest, disableRetries?: boolean);
    hasAnyClients: () => boolean;
    getClients: () => WebClient[];
    hasSelectedClient: () => boolean;
    getSelectedClient: () => WebClient | undefined;
    getClient: (installId: string) => WebClient | undefined;
}
