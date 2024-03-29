export interface IntegrationParam {
    /** Name of the parameter. */
    name: string | null;
    /** Label of the parameter. */
    label: string | null;
    /** Short description of the parameter. */
    description: string | null;
    /** Whether the parameter is required to be set to use the destination. If unspecified, this defaults to false. */
    required: boolean;
    /** Whether the parameter has a value set. */
    has_value: boolean;
    /** The current value of the parameter. Always null if the value is sensitive. When writing, null values will be ignored. Set the value to an empty string to clear it. */
    value: string | null;
    /** When present, the param's value comes from this user attribute instead of the 'value' parameter. Set to null to use the 'value'. */
    user_attribute_name: string | null;
    /** Whether the parameter contains sensitive data like API credentials. If unspecified, this defaults to true. */
    sensitive: boolean;
    /** When true, this parameter must be assigned to a user attribute in the admin panel (instead of a constant value), and that value may be updated by the user as part of the integration flow. */
    per_user: boolean;
    /** When present, the param represents the oauth url the user will be taken to. */
    delegate_oauth_url: string | null;
}
export interface RequestIntegrationParam {
    /** Name of the parameter. */
    name?: string | null;
    /** The current value of the parameter. Always null if the value is sensitive. When writing, null values will be ignored. Set the value to an empty string to clear it. */
    value?: string | null;
    /** When present, the param's value comes from this user attribute instead of the 'value' parameter. Set to null to use the 'value'. */
    user_attribute_name?: string | null;
}
