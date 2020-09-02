import * as Hub from '../../hub'
import { PagerDutyCreateIncident } from './pagerduty_create_incident'
import * as moment from 'moment'

export class PagerDutyForm {
    static ServiceKeyKey = 'service_key'
    static DeDeuplicationIdColumnKey = 'deduplication_id_column'
    static AutoResolveKey = 'auto_resolution_boolean'
    static MaxIncidentsKey = 'max_incidents'

    static formFields: Hub.ActionFormField[] = [
        {
            label: 'Service key',
            type: 'string',
            name: PagerDutyForm.ServiceKeyKey,
            description: 'An Events API v2 integration key',
            required: true
        }, {
            label: 'De-duplication id column',
            name: PagerDutyForm.DeDeuplicationIdColumnKey,
            description: 'Column in the result set that uniquely identifies an alert',
            type: 'string',
            required: true
        }
        , {
            label: 'Enable automatic resolution',
            name: PagerDutyForm.AutoResolveKey,
            description: 'Automatically resolves incidents',
            type: 'string',
            default: 'true',
            required: true
        },
        {
            label: 'Maximum number of incidents',
            name: PagerDutyForm.MaxIncidentsKey,
            description: 'Maximum number of incidents to create based on result set',
            type: 'string',
            default: '10',
            required: true
        }
    ]

    static create(json: any): PagerDutyForm | undefined {
        if (json == null) {
            return undefined
        }

        const keys = [PagerDutyForm.ServiceKeyKey,
        PagerDutyForm.DeDeuplicationIdColumnKey,
        PagerDutyForm.AutoResolveKey,
        PagerDutyForm.MaxIncidentsKey
        ]

        const ok = keys.reduce((p: boolean, key: string) => p && json[key] != null, true)

        if (!ok) return undefined

        return new PagerDutyForm(json[PagerDutyForm.ServiceKeyKey], json[PagerDutyForm.DeDeuplicationIdColumnKey],
            json[PagerDutyForm.AutoResolveKey],
            json[PagerDutyForm.MaxIncidentsKey]
        )
    }

    constructor(public service_key: string, public deduplication_id_column: string, public auto_resolution_boolean: boolean, public max_incidents: string) { }

    public createPagerDutyIncidents(resultSet: any[]): Hub.ValidationError | PagerDutyCreateIncident[] {
        return resultSet.reduce<Hub.ValidationError | PagerDutyCreateIncident[]>((acc, el) => {
            if (!Array.isArray(acc)) return acc

            if (el[this.deduplication_id_column] == null)
                return {
                    field: PagerDutyForm.DeDeuplicationIdColumnKey,
                    message: `Couldn't find column ${this.deduplication_id_column} in result set`
                }

            // TODO: Decide whether to expose or ignore commented out fields
            const incident: PagerDutyCreateIncident = {
                routing_key: this.service_key,
                event_action: 'trigger',
                dedup_key: el[this.deduplication_id_column] as string,
                payload: {
                    summary: "A summary",
                    severity: 'warning',
                    source: "Looker source",
                    timestamp: moment().format(),
                    // component?: string,
                    // group?: string,
                    // class: string,
                    // custom_details?: any
                },
                // client?: string,
                // client_url?: string,
                // links?: LinkParam[],
                // images?: ImageParam[]
            }

            return acc.concat([incident])
        }, [] as PagerDutyCreateIncident[])
    }
}