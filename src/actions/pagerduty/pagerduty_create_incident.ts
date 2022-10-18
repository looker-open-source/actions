/**
 * API reference:
 * 
 * https://developer.pagerduty.com/api-reference/reference/events-v2/openapiv3.json/paths/~1enqueue/post
 */
export interface PagerDutyCreateIncident {
    routing_key: string,
    event_action: PagerDutyEventAction,
    dedup_key: string,
    payload?: PagerDutyCreateIncidentPayload,
    client?: string,
    client_url?: string,
    links?: LinkParam[],
    images?: ImageParam[]
}

export enum PagerDutyEventAction {
    Trigger = "trigger",
    Acknowledge = "acknowledge",
    Resolve = "resolve"
}

export interface LinkParam {
    href: string,
    text: string
}

export interface ImageParam {
    src?: string, href?: string, alt?: string
}

export interface PagerDutyCreateIncidentPayload {
    summary: string,
    severity: 'critical' | 'warning' | 'error' | 'info',
    source: string,
    timestamp?: string,
    component?: string,
    group?: string,
    // class: string,
    custom_details?: CustomDetails
}

export interface CustomDetails {
    managed_by_looker: boolean,
    auto_resolve: boolean,
    schedule_id: string
}