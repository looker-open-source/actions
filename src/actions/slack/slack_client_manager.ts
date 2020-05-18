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
                this.clients = (JSON.parse(stateJson) as WorkspaceAwareStateJson[])
                    .reduce((accumulator, stateJsonItem) => {
                        const ws = stateJsonItem.install_id
                        if (stateJsonItem.token) {
                            accumulator[ws] = makeSlackClient(stateJsonItem.token)
                        }
                        return accumulator
                    }, {} as { [key: string]: WebClient })

                if (request.formParams.workspace) {
                    this.selectedInstallId = request.formParams.workspace
                } else {
                    /**
                     * To fallback to the first client if there isn't any selected.
                     * This is to allow existing schedules to work without the user has to
                     * go back to the scheduler modal to select the workspace.
                     */
                    this.selectedInstallId = Object.keys(this.clients)[0]
                }
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
