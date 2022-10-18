import { CustomDetails } from './pagerduty_create_incident'

/**
 * API Reference
 * 
 * https://developer.pagerduty.com/api-reference/reference/REST/openapiv3.json/paths/~1incidents/get
 */
export interface PagerDutyIncident {
    id: string
}

export interface PagerDutyAlert {
    id: string,
    alert_key: string,
    body?: { details?: CustomDetails}
}