import { Service } from './service'
import got from 'got'

export class PagerDutyClient {

    constructor(private apiKey: string) { }

    private client = got.extend({
        prefixUrl: 'https://api.pagerduty.com',
        headers: {
            'Authorization': `Token token=${this.apiKey}`,
            'Accept': 'application/json'
        }
    })

    async services(): Promise<Service[]> {
        console.log("ENTRY SERVICES")
        const res = await this.client.get('services').json<{services: Service[]}>()
        console.log("AFTER AWAIT SERVICES")
        return res.services
    }

    private isServices(json: any): json is { services: Service[] } {
        if (json == null) {
            return false
        }

        if (!Array.isArray(json['services'])) {
            return false
        }

        return json['services'].reduce(
            (p: Boolean, c: any) => p && c['name'] != null && c['id'] != null,
            true
        )
    }
}