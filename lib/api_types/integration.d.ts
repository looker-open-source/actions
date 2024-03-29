import { IntegrationParam, RequestIntegrationParam } from './integration_param';
import { IntegrationRequiredField } from './integration_required_field';
export declare enum IntegrationSupportedActionTypes {
    Cell = "cell",
    Query = "query",
    Dashboard = "dashboard"
}
export declare enum IntegrationSupportedDownloadSettings {
    Push = "push",
    Url = "url"
}
export declare enum IntegrationSupportedFormats {
    Txt = "txt",
    Csv = "csv",
    InlineJson = "inline_json",
    Json = "json",
    JsonLabel = "json_label",
    JsonDetail = "json_detail",
    JsonDetailLiteStream = "json_detail_lite_stream",
    Xlsx = "xlsx",
    Html = "html",
    WysiwygPdf = "wysiwyg_pdf",
    AssembledPdf = "assembled_pdf",
    WysiwygPng = "wysiwyg_png",
    CsvZip = "csv_zip"
}
export declare enum IntegrationSupportedFormattings {
    Formatted = "formatted",
    Unformatted = "unformatted"
}
export declare enum IntegrationSupportedVisualizationFormattings {
    Apply = "apply",
    Noapply = "noapply"
}
export interface Integration {
    /** Operations the current user is able to perform on this object */
    can: {
        [key: string]: boolean;
    };
    /** ID of the integration. */
    id: string;
    /** ID of the integration hub. */
    integration_hub_id: number;
    /** Label for the integration. */
    label: string;
    /** Description of the integration. */
    description: string | null;
    /** Whether the integration is available to users. */
    enabled: boolean;
    /** Array of params for the integration. */
    params: IntegrationParam[];
    /** A list of data formats the integration supports. If unspecified, the default is all data formats. Valid values are: "txt", "csv", "inline_json", "json", "json_label", "json_detail", "json_detail_lite_stream", "xlsx", "html", "wysiwyg_pdf", "assembled_pdf", "wysiwyg_png", "csv_zip". */
    supported_formats: IntegrationSupportedFormats[];
    /** A list of action types the integration supports. Valid values are: "cell", "query", "dashboard". */
    supported_action_types: IntegrationSupportedActionTypes[];
    /** A list of formatting options the integration supports. If unspecified, defaults to all formats. Valid values are: "formatted", "unformatted". */
    supported_formattings: IntegrationSupportedFormattings[];
    /** A list of visualization formatting options the integration supports. If unspecified, defaults to all formats. Valid values are: "apply", "noapply". */
    supported_visualization_formattings: IntegrationSupportedVisualizationFormattings[];
    /** A list of all the download mechanisms the integration supports. The order of values is not significant: Looker will select the most appropriate supported download mechanism for a given query. The integration must ensure it can handle any of the mechanisms it claims to support. If unspecified, this defaults to all download setting values. Valid values are: "push", "url". */
    supported_download_settings: IntegrationSupportedDownloadSettings[];
    /** URL to an icon for the integration. */
    icon_url: string | null;
    /** Whether the integration uses oauth. */
    uses_oauth: boolean | null;
    /** A list of descriptions of required fields that this integration is compatible with. If there are multiple entries in this list, the integration requires more than one field. If unspecified, no fields will be required. */
    required_fields: IntegrationRequiredField[];
    /** Whether the integration uses delegate oauth, which allows federation between an integration installation scope specific entity (like org, group, and team, etc.) and Looker. */
    delegate_oauth: boolean | null;
    /** Whether the integration is available to users. */
    installed_delegate_oauth_targets: number[];
}
export interface RequestIntegration {
    /** Whether the integration is available to users. */
    enabled?: boolean;
    /** Array of params for the integration. */
    params?: RequestIntegrationParam[];
    /** Whether the integration is available to users. */
    installed_delegate_oauth_targets?: number[];
}
