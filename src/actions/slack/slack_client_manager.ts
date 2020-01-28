import {WebClient} from "@slack/client"
import * as semver from "semver"
import * as Hub from "../../hub"

const PLACEHOLDER_WORKSPACE = "any"

interface WorkspaceAwareStateJson {
    install_id: string,
    token: string
}

export const MULTI_WORKSPACE_SUPPORTED_VERSION = "7.1.0"

export const makeSlackClient = (token: string): WebClient => new WebClient(token)

export class SlackClientManager {
    private selectedInstallId: string | undefined
    private clients: { [key: string]: WebClient }

    constructor(request: Hub.ActionRequest) {
        const stateJson = request.params.state_json

        if (!stateJson) {
            this.clients = {}
        } else if (request.lookerVersion && semver.gte(request.lookerVersion, MULTI_WORKSPACE_SUPPORTED_VERSION)) {
            this.selectedInstallId = request.formParams.workspace
            this.clients = (JSON.parse(stateJson) as WorkspaceAwareStateJson[])
                .reduce((accumulator, stateJsonItem) => {
                    if (stateJsonItem.token) {
                        accumulator[stateJsonItem.install_id] = makeSlackClient(stateJsonItem.token)
                    }
                    return accumulator
                }, {} as { [key: string]: WebClient })
        } else {
            this.selectedInstallId = PLACEHOLDER_WORKSPACE
            this.clients = {[PLACEHOLDER_WORKSPACE]: makeSlackClient(stateJson)}
        }
    }

    hasAnyClients = (): boolean => Object.entries(this.clients).length > 0

    getClients = (): WebClient[] => Object.values(this.clients)

    hasSelectedClient = (): boolean => !!this.selectedInstallId

    getSelectedClient = (): WebClient | null => this.selectedInstallId ? this.clients[this.selectedInstallId] : null

    getClient = (installId: string): WebClient | null => this.clients[installId]
}
