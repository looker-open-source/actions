import { Service } from './service'
import got, { Got } from 'got'
import { PagerDutyCreateIncident } from './pagerduty_create_incident'
import { PagerDutyIncident } from './pagerduty_incident'
import * as Hub from "../../hub"
import { promises } from 'fs'

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
        const res = await this.restApiClient.get('services').json<{ services: Service[] }>()
        return res.services
    }

    async createIncidents(incidents: PagerDutyCreateIncident[]): Promise<Hub.ActionResponse> {
        const serviceKeys = Array.from(new Set(incidents.map(i => i.routing_key)))
        console.info(`Creating ${incidents.length} incidents on PagerDuty services ${serviceKeys.join(", ")} `)

        const promises = incidents.map(i =>
            got.post(`${this.PagerDutyEventApi}/enqueue`, {
                json: i
            }).json()
        )

        return Promise.all(promises)
            .then(r => {
                const message = `Pushed ${incidents.length} incidents (might be deduped) to PagerDuty`
                console.log(message)
                return new Hub.ActionResponse({ success: true, message: message })
            })
            .catch(r => {
                const message = `Failed to create PD incident ${r}`
                console.error(message)
                return new Hub.ActionResponse({ success: false, message: message })
            })
    }

    async getIncidents(): Promise<PagerDutyIncident[]> {
        return Promise.reject("Not implemented")
    }


}