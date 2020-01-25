import {WebClient} from "@slack/client"
import * as semver from "semver"
import * as Hub from "../../hub"

const PLACEHOLDER_WORKSPACE = "any"

interface WorkspaceAwareStateJson {
    install_id: string,
    token: string
}

export class SlackClientManager {
    private selectedInstallId: string | undefined
    private clients: { [key: string]: WebClient }

    constructor(request: Hub.ActionRequest) {
        const stateJson = request.params.state_json

        if (!stateJson) {
            this.clients = {}
        } else if (request.lookerVersion && semver.gte(request.lookerVersion, "7.1.0")) {
            this.selectedInstallId = request.formParams.workspace
            this.clients = (JSON.parse(stateJson) as WorkspaceAwareStateJson[])
                .reduce((accumulator, stateJsonItem) => {
                    if (stateJsonItem.token) {
                        accumulator[stateJsonItem.install_id] = this.makeClient(stateJsonItem.token)
                    }
                    return accumulator
                }, {} as { [key: string]: WebClient })
        } else {
            this.selectedInstallId = PLACEHOLDER_WORKSPACE
            this.clients = {[PLACEHOLDER_WORKSPACE]: this.makeClient(stateJson)}
        }
    }

    hasAnyClients = (): boolean => Object.entries(this.clients).length === 0

    getClients = (): WebClient[] => Object.values(this.clients)

    hasSelectedClient = (): boolean => !!this.selectedInstallId

    getSelectedClient = (): WebClient | null => this.selectedInstallId ? this.clients[this.selectedInstallId] : null

    getClient = (installId: string): WebClient | null => this.clients[installId]

    private makeClient = (token: string): WebClient => new WebClient(token)
}
