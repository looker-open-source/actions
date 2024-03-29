export interface Query {
    /** Operations the current user is able to perform on this object */
    can: {
        [key: string]: boolean;
    };
    /** Unique Id */
    id: number;
    /** Model */
    model: string;
    /** Explore Name */
    view: string;
    /** Fields */
    fields: string[] | null;
    /** Pivots */
    pivots: string[] | null;
    /** Fill Fields */
    fill_fields: string[] | null;
    /** Filters */
    filters: {
        [key: string]: string;
    } | null;
    /** Filter Expression */
    filter_expression: string | null;
    /** Sorting for the query results. Use the format `["view.field", ...]` to sort on fields in ascending order. Use the format `["view.field desc", ...]` to sort on fields in descending order. Use `["__UNSORTED__"]` (2 underscores before and after) to disable sorting entirely. Empty sorts `[]` will trigger a default sort. */
    sorts: string[] | null;
    /** Limit */
    limit: string | null;
    /** Column Limit */
    column_limit: string | null;
    /** Total */
    total: boolean | null;
    /** Raw Total */
    row_total: string | null;
    /** Fields on which to run subtotals */
    subtotals: string[] | null;
    /** Visualization configuration properties. These properties are typically opaque and differ based on the type of visualization used. There is no specified set of allowed keys. The values can be any type supported by JSON. A "type" key with a string value is often present, and is used by Looker to determine which visualization to present. Visualizations ignore unknown vis_config properties. */
    vis_config: {
        [key: string]: any;
    } | null;
    /** The filter_config represents the state of the filter UI on the explore page for a given query. When running a query via the Looker UI, this parameter takes precedence over "filters". When creating a query or modifying an existing query, "filter_config" should be set to null. Setting it to any other value could cause unexpected filtering behavior. The format should be considered opaque. */
    filter_config: {
        [key: string]: any;
    } | null;
    /** Visible UI Sections */
    visible_ui_sections: string | null;
    /** Slug */
    slug: string | null;
    /** Dynamic Fields */
    dynamic_fields: string | null;
    /** Client Id: used to generate shortened explore URLs. If set by client, must be a unique 22 character alphanumeric string. Otherwise one will be generated. */
    client_id: string | null;
    /** Share Url */
    share_url: string | null;
    /** Expanded Share Url */
    expanded_share_url: string | null;
    /** Expanded Url */
    url: string | null;
    /** Query Timezone */
    query_timezone: string | null;
    /** Has Table Calculations */
    has_table_calculations: boolean;
}
export interface RequestQuery {
    /** Model */
    model?: string;
    /** Explore Name */
    view?: string;
    /** Fields */
    fields?: string[] | null;
    /** Pivots */
    pivots?: string[] | null;
    /** Fill Fields */
    fill_fields?: string[] | null;
    /** Filters */
    filters?: {
        [key: string]: string;
    } | null;
    /** Filter Expression */
    filter_expression?: string | null;
    /** Sorting for the query results. Use the format `["view.field", ...]` to sort on fields in ascending order. Use the format `["view.field desc", ...]` to sort on fields in descending order. Use `["__UNSORTED__"]` (2 underscores before and after) to disable sorting entirely. Empty sorts `[]` will trigger a default sort. */
    sorts?: string[] | null;
    /** Limit */
    limit?: string | null;
    /** Column Limit */
    column_limit?: string | null;
    /** Total */
    total?: boolean | null;
    /** Raw Total */
    row_total?: string | null;
    /** Fields on which to run subtotals */
    subtotals?: string[] | null;
    /** Visualization configuration properties. These properties are typically opaque and differ based on the type of visualization used. There is no specified set of allowed keys. The values can be any type supported by JSON. A "type" key with a string value is often present, and is used by Looker to determine which visualization to present. Visualizations ignore unknown vis_config properties. */
    vis_config?: {
        [key: string]: any;
    } | null;
    /** The filter_config represents the state of the filter UI on the explore page for a given query. When running a query via the Looker UI, this parameter takes precedence over "filters". When creating a query or modifying an existing query, "filter_config" should be set to null. Setting it to any other value could cause unexpected filtering behavior. The format should be considered opaque. */
    filter_config?: {
        [key: string]: any;
    } | null;
    /** Visible UI Sections */
    visible_ui_sections?: string | null;
    /** Dynamic Fields */
    dynamic_fields?: string | null;
    /** Client Id: used to generate shortened explore URLs. If set by client, must be a unique 22 character alphanumeric string. Otherwise one will be generated. */
    client_id?: string | null;
    /** Query Timezone */
    query_timezone?: string | null;
}
