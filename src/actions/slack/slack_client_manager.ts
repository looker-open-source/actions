import {WebClient} from "@slack/client"
import * as semver from "semver"
import * as winston from "winston"
import * as Hub from "../../hub"

export const PLACEHOLDER_WORKSPACE = "any"

interface WorkspaceAwareStateJson {
    install_id: string,
    token: string
}

export const MULTI_WORKSPACE_SUPPORTED_VERSION = "7.3.0"

export const isSupportMultiWorkspaces = (request: Hub.ActionRequest) =>
    request.lookerVersion && semver.gte(request.lookerVersion, MULTI_WORKSPACE_SUPPORTED_VERSION)

export const makeSlackClient = (token: string): WebClient => new WebClient(token)

export class SlackClientManager {
    private selectedInstallId: string | undefined
    private clients: { [key: string]: WebClient }

    constructor(request: Hub.ActionRequest) {
        const stateJson = request.params.state_json

        if (!stateJson) {
            this.clients = {}
        } else {
            const supportMultiWs =
                request.lookerVersion && semver.gte(request.lookerVersion, MULTI_WORKSPACE_SUPPORTED_VERSION)
            let json = stateJson
            if (supportMultiWs) {
                try {
                    json = JSON.parse(stateJson)
                } catch (e) {
                    winston.warn("Received malform JSON for supported multi tenant version. Proceeding as str.")
                }
            }
            if (supportMultiWs && Array.isArray(json)) {
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
    }

    hasAnyClients = (): boolean => Object.entries(this.clients).length > 0

    getClients = (): WebClient[] => Object.values(this.clients)

    hasSelectedClient = (): boolean => !!this.selectedInstallId

    getSelectedClient = (): WebClient | undefined => this.selectedInstallId ?
        this.clients[this.selectedInstallId] : undefined

    getClient = (installId: string): WebClient | undefined => this.clients[installId]
}
