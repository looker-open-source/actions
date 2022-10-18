/**
 * API Reference:
 * 
 * https://developer.pagerduty.com/api-reference/reference/REST/openapiv3.json/paths/~1services/get
 */
export interface Integration {
    integration_key: string
}

export interface Service {
    id: string;
    name: string;
    description: string;
    integrations: Integration[]
}