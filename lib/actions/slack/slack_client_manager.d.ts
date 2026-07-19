import { WebClient } from "@slack/web-api";
import * as Hub from "../../hub";
export declare const PLACEHOLDER_WORKSPACE = "any";
export declare const MULTI_WORKSPACE_SUPPORTED_VERSION = "7.3.0";
export declare const isSupportMultiWorkspaces: (request: Hub.ActionRequest) => boolean | "" | null;
export declare const makeSlackClient: (token: string, disableRetries?: boolean) => WebClient;
export declare class SlackClientManager {
    private selectedInstallId;
    private clients;
    /**
     * Initializes the Slack clients by parsing the stateJson payload.
     * Overrides with decryptedStateJson if provided (opportunistic decryption).
     */
    constructor(request: Hub.ActionRequest, disableRetries?: boolean, decryptedStateJson?: string);
    /** Checks if there are any initialized Slack clients. */
    hasAnyClients: () => boolean;
    /** Gets all initialized Slack clients as an array. */
    getClients: () => WebClient[];
    /** Checks if a specific client is selected. */
    hasSelectedClient: () => boolean;
    /** Gets the currently selected Slack client or defaults to the first available connection. */
    getSelectedClient: () => WebClient | undefined;
    /** Gets a specific client by its install ID. */
    getClient: (installId: string) => WebClient | undefined;
}
