import { Service, Integration } from './service'
import got from 'got'
import { PagerDutyCreateIncident, PagerDutyEventAction } from './pagerduty_create_incident'
import { PagerDutyIncident, PagerDutyAlert } from './pagerduty_incident'
import * as Hub from "../../hub"
import * as moment from 'moment'

export class PagerDutyClient {

    constructor(private apiKey: string) { }

    private PagerDutyEventApi = 'https://events.pagerduty.com/v2'

    private restApiClient = got.extend({
        prefixUrl: 'https://api.pagerduty.com',
        headers: {
            'Authorization': `Token token=${this.apiKey}`,
            'Accept': 'application/json'
        }
    })

    async services(): Promise<Service[]> {
        const res = await this.restApiClient.get('services?include[]=integrations').json<{ services: Service[] }>()
        return res.services
    }

    async incidents(service: Service): Promise<PagerDutyIncident []> {
        const res = await this.restApiClient
            .get(`incidents?include[]=incident_key&service_ids[]=${service.id}&statuses[]=triggered&statuses[]=acknowledged`)
            .json<{ incidents: PagerDutyIncident[] }>()
        return res.incidents
    }

    async alerts(incident: PagerDutyIncident): Promise<PagerDutyAlert []> {
        const res = await this.restApiClient.get(`incidents/${incident.id}/alerts`).json<{ alerts: PagerDutyAlert[] }>()
        return res.alerts
    }

    async createIncidents(incidents: PagerDutyCreateIncident[], serviceKeys: string[], scheduleId: string): Promise<Hub.ActionResponse> {
        const newAlertKeys = incidents.map(i => i.dedup_key)

        incidents.forEach(i => console.info(`Incident "${i.dedup_key}" received on routing key "${i.routing_key}"`))

        const activeAlertsPerRoutingKeyPromise = this.getAlertsManagedByLooker(serviceKeys, scheduleId)
            .then(activeAlertsPerRoutingKey => {
                activeAlertsPerRoutingKey.forEach(keyAndAlerts => {
                    keyAndAlerts.alerts.forEach(a =>
                        console.info(`Active alert "${a.alert_key}" on routing key "${keyAndAlerts.routingKey}"`)
                    )
                })
                return activeAlertsPerRoutingKey
            })

        const alertsToResolvePerRroutingKeyPromise = this.getAlertsToResolve(activeAlertsPerRoutingKeyPromise, newAlertKeys)
            .then(alertsPerKeys => {
                alertsPerKeys.forEach(alertsPerKey => alertsPerKey.alerts.forEach(alert =>
                    console.info(`Resolving "${alert.alert_key}" on routing key ${alertsPerKey.routingKey}`)
                ))
                return alertsPerKeys
            })

        const resolveAlertsPromise = alertsToResolvePerRroutingKeyPromise
            .then(keysAndAlerts =>
                keysAndAlerts.flatMap(keyAndAlerts =>
                    keyAndAlerts.alerts.map(alert => {
                        const resolveIncident: PagerDutyCreateIncident = {
                            routing_key: keyAndAlerts.routingKey,
                            event_action: PagerDutyEventAction.Resolve,
                            dedup_key: alert.alert_key,
                            payload: {
                                summary: "Looker auto-resolving alert",
                                severity: 'warning',
                                source: "Looker actions",
                                timestamp: moment().format(),
                            }
                        }
                        return resolveIncident
                    })
                )
            )
            .then(incidents =>
                Promise.all(incidents.map(incident =>
                    got.post(`${this.PagerDutyEventApi}/enqueue`, {
                        json: incident
                   })
                ))
            )

        const triggerAlertsPromises = Promise.all(
            incidents.map(i =>
                got.post(`${this.PagerDutyEventApi}/enqueue`, {
                    json: i
                })
            )
        )

        return Promise.all([triggerAlertsPromises, resolveAlertsPromise])
            .then(r => {
                const responses = r.reduce((a, b) => a.concat(b))
                const message = `Pushed ${responses.length} alerts (might be deduped) to PagerDuty`
                console.info(message)
                return new Hub.ActionResponse({ success: true, message: message })
            })
            .catch(reason => {
                const message = `Failed to create PD incidents ${reason}`
                console.error(message)
                console.log(reason)
                return new Hub.ActionResponse({ success: false, message: message })
            })

    }

    private getAlertsManagedByLooker(serviceKeys: string[], scheduleId: string): Promise<AlertsPerRoutingKey[]> {

        const keysAndIncidentsPromise = this.services()
            .then(services =>
                services
                    .flatMap(service => service.integrations.map(integration => {
                        const serviceAndIntegration:[Service, Integration] = [service, integration]
                        return serviceAndIntegration
                    }))
                    .filter(serviceAndIntegration => serviceKeys.includes(serviceAndIntegration[1].integration_key))
                    .map(serviceAndIntegration => {
                        const keysAndService:[string, Service] = [serviceAndIntegration[1].integration_key, serviceAndIntegration[0]]
                        return keysAndService
                    })
            )
            .then(keysAndServices =>
                Promise.all(
                    keysAndServices.map(keyAndService =>
                        this.incidents(keyAndService[1]).then(incidents => {
                            const keysAndIncidents:[string, PagerDutyIncident[]] = [keyAndService[0], incidents]
                            return keysAndIncidents
                        })
                    )
                )
            )

        return keysAndIncidentsPromise
            .then(keysAndIncidents =>
                Promise.all(
                    keysAndIncidents.flatMap(keyAndIncidents =>
                        keyAndIncidents[1].map(incident =>
                            this.alerts(incident).then(alerts =>
                                new AlertsPerRoutingKey(
                                    keyAndIncidents[0],
                                    // TODO: Optional chaining added in TS 3.7
                                    alerts.filter(a => a.body &&
                                        a.body.details &&
                                        a.body.details.managed_by_looker &&
                                        a.body.details.auto_resolve &&
                                        a.body.details.schedule_id == scheduleId)
                                )
                            )
                        )
                    )
                )
            )
        }

    private getAlertsToResolve(
        activeAlertsPerRoutingKeyPromise: Promise<AlertsPerRoutingKey[]>,
        newAlertKeys: string[]
    ): Promise<AlertsPerRoutingKey[]> {
        return activeAlertsPerRoutingKeyPromise
            .then(keysAndAlerts =>
                keysAndAlerts.map(keyAndAlerts =>
                    new AlertsPerRoutingKey(
                        keyAndAlerts.routingKey,
                        keyAndAlerts.alerts.filter(alert => !newAlertKeys.includes(alert.alert_key))
                    )
                )
            )
        }

}


class AlertsPerRoutingKey {
    constructor(public routingKey: string, public alerts: PagerDutyAlert[]) {}
}