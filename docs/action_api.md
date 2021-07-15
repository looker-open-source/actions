# Looker Action API

To build an action directly into an existing web service in any language, you can have your server implement the Action API directly. Your server then becomes an "Action Hub" that can be connected to one or more Looker instances. An Action Hub can expose one or more actions.

The Action API is a simple webhook-like API to accept actions from Looker. Your server will provide a few endpoints that Looker can call to list and execute actions.

Be sure to review the [official Action Hub docs](https://docs.looker.com/sharing-and-publishing/action-hub) before diving in to the details here.

## Endpoints

To implement the Action API, your server must expose a few endpoints for Looker to call:

- [Actions List Endpoint](#actions-list-endpoint)

  This endpoint lists all the actions your hub exposes. Each listed action contains metadata instructing Looker how to execute your action. It indicates what data payload formats are supported, what information (if any) to collect from the Looker administrator (such as API keys), and if the action also has an end-user facing Action Form.

  The URL of this endpoint is entered into the Looker admin panel (as the **Action Hub URL**) and is how admins connect Looker to your action hub.

- [Action Execute Endpoint](#action-execute-endpoint)

  This is the endpoint to which Looker sends the data payload, form information, and other metadata to execute a given action. This is the main implementation of your action. This endpoint works the same way as a Looker webhook endpoint.

- (optional) [Action Form Endpoint](#action-form-endpoint)

  If the action's definition specifies a form, Looker asks this endpoint for a form template to display to the user to configure the action (e.g. when using the action as a destination in the Schedule dialog). Since Looker will query this endpoint every time the form is displayed, it's possible to dynamically populate the form with custom user input fields. For example, for a chat application the form might have a drop-down that dynamically lists all the chat channels available at that moment. Or for an action that uses OAuth with the Google Analytics API, the form could dynamically list the web properties to which the current user has access. Form fields can also specify the "interactive" option in order to re-query the form endpoint upon changes by the end user. This allows implementation of faceted select options or branching logic.

These endpoints can optionally require [authentication](#authentication) via a token sent in the request headers, in order to verify that the requests originate from an authorized Looker instance. Individual actions can also implement OAuth in order to securely authenticate end users to 3rd party services.

### Actions List Endpoint

Looker will send an HTTP POST request with an empty body to this endpoint.

The endpoint should return a JSON body with an `integrations` key containing a list of actions.

Here's an example of a list containing a single integration:

```json
{
  "label": "My Action Hub",
  "integrations": [
    {
      "name": "my_action",
      "label": "My Great Action",
      "supported_action_types": ["cell"],
      "url": "https://example.com/actions/my_action/execute",
      "icon_data_uri": "data:image/gif;base64,R0lGODlhEAA....",
      "params": [
        {"name": "api_key", "label": "API Key", "required": true}
      ]
    }
  ]
}
```

Here's a full description of the available options for the `ActionList` response (in TypeScript format):

```ts
interface ActionList {
  /** A label for the Hub that will be shown in the Looker admin page **/
  label: string
  /** (required) An array of action definition objects. */
  integrations: ActionDefinition[]
}

interface ActionDefinition {
  /** (required) A unique name for the action. This should be unique across all actions in the hub. */
  name: string
  /** (required) A human-readable label for the action. */
  label: string
  /** Description of the action. */
  description?: string
  /** A Data URI reprensenting an icon image for the action. */
  icon_data_uri?: string
  /** (required) An absolute URL of the execute endpoint for this action. */
  url: string
  /** An absolute URL of the form endpoint for this action. */
  form_url?: string
  /** Array of params for the action. */
  params?: Param[]
  /** A list of descriptions of required fields that this action is compatible with. If there are multiple entries in this list, the action requires more than one field. */
  required_fields?: RequiredField[]
  /** (required) A list of action types the action supports. Valid values are: "cell", "query", "dashboard". Use "query" to see your action in the send form */
  supported_action_types: string[]
  /** A list of data formats the action supports. Valid values are: "txt", "csv", "inline_json", "json", "json_detail", "json_detail_lite_stream", "xlsx", "html", "wysiwyg_pdf", "assembled_pdf", "wysiwyg_png", "csv_zip". */
  supported_formats?: string[]
  /** A list of formatting options the action supports. Valid values are: "formatted", "unformatted". */
  supported_formattings?: string[]
  /** A list of visualization formatting options the action supports. Valid values are: "apply", "noapply". */
  supported_visualization_formattings?: string[]
  /** A list of download settings the action supports. Valid values are: "push", "url". Push means that the data will be sent directly with the request to the execute endpoint. Url means the action will be provided with a one-time use download url, which facilitates streaming of large result sets. Default is "push".  */
  supported_download_settings: string[]
  /** A boolean that determines whether the action uses oauth action or not. This will determine whether the action will be sent a one-time use link to set state for the specific user of this action */
  uses_oauth: boolean
}

interface Param {
  /** (required) Name of the parameter. */
  name: string
  /** (required) Label of the parameter. */
  label: string
  /** Short description of the parameter. */
  description?: string
  /** If present, the value of this param will come from the value of the user attribute with the given name. If the param is also required, then the user must have a valid value for the attribute in order to see the action as a destination option. */
  user_attribute_name: string | null
  /** Whether the parameter is required to be set to use the action. (default: false) */
  required?: boolean
  /** Whether the parameter contains sensitive data like API credentials. If so, it will be encrypted and never shown in the Looker UI. (default: true) */
  sensitive?: boolean
}

interface RequiredField {
  /** (optional) If present, matches a field that has this tag. */
  tag?: string
  /** (optional) If present, supercedes 'tag' and matches a field that has any of the provided tags. */
  any_tag?: string[]
  /** (optional) If present, supercedes 'tag' and matches a field that has all of the provided tags. */
  all_tags?: string[]
}
```

### Action Execute Endpoint

When the user initiates an action (either manually or by scheduling it), Looker will typically run the relevant query and then POST the data to the execute endpoint.

The payload sent to this endpoint is always JSON and is always sent using [chunked transfer encoding](https://en.wikipedia.org/wiki/Chunked_transfer_encoding) to facilitate streaming data from the analytical database.

If the `supported_download_settings` is set to "url" then the payload will instead contain a one-time use download url instead of including the data in the payload. 

The payload format here is the same as the Looker Webhook format which is as follows:

```ts
interface ExecutePayload {
  /** The type of data payload. Valid values are: "cell", "query", "dashboard". */
  type: string
  /** The associated scheduled plan, if this payload is on a schedule. */
  scheduled_plan: ExecutePayloadScheduledPlan | null
  /** Attached data, if the payload data is a file and the integration specifies "push" in its supported_download_settings. */
  attachment: DataWebhookPayloadAttachment | null
  /** Data, if the payload data is in an inline format and the integration specifies "push" in its supported_download_settings. */
  data: {[key: string]: string} | null
  /** Form parameters associated with the payload. */
  form_params: {[key: string]: string} | null
}

interface ExecutePayloadScheduledPlan {
  /** ID of the scheduled plan */
  scheduled_plan_id: number | null
  /** Title of the scheduled plan. */
  title: string | null
  /** Type of content of the scheduled plan. Valid values are: "Look", "Dashboard". */
  type: string
  /** URL of the content item in Looker. */
  url: string | null
  /** ID of the query that the data payload represents. */
  query_id: number | null
  /** Query that was run (not available for dashboards) */
  query: Query | null
  /** A boolean representing whether this schedule payload has customized the filter values compared to the underlying content item. */
  filters_differ_from_look: boolean
  /** If this scheduled plan is from an integration that has included "url" in its supported_download_settings, this field contains a temporary URL that can be used to fetch the query results. The temporary URL will expire 3600 seconds after the time the schedule was run. The temporary URL will expire after one use. */
  download_url: string | null
}

interface ExecutePayloadAttachment {
  /** MIME type of the attachment. Ends with ";base64" if the attachment is Base64 encoded. */
  mimetype: string
  /** File extension of the attachment. */
  extension: string
  /** Attachment data. For JSON formats, this JSON is inline. Otherwise it's a string. */
  data: string | JSON
}
```

### Action Form Endpoint

When the user initiates an action, if `form_url` was defined in the action definition, Looker will request the form endpoint by sending a POST request with an empty body. For scheduled actions, the form information will be collected from the user at the time the schedule is set up. Otherwise, it is collected immediately before executing the action.

The endpoint should return the structure of a form that Looker will display to the user. When the action executes, the user's inputs will appear in the `form_params` part of the payload. Form parameters are always strings. Your action implementation can parse those strings into numbers or whatever else you like.

The form body can be a JSON array of form fields:

```json
[
  {"name": "myformparam", "label": "My Form Param"},
  {"name": "body", "label": "Body Text", "type": "textarea"}
]
```

Or it can be an object with the fields array in addition to a state update (see Action User State below) or Error object:

```json
{
  fields: [],
  state: {
    data: '{"my_object_1":{"foo":"bar"},"my_object_2":{"foo":"bar"}}',
    refresh_time: 86400
  },
  error: "Failed to fetch data to populate fields"
}
```

Here's a Typescript definition for the response of a form request
```ts
class ActionForm {
  /** See ActionFormField definition below */
  fields: ActionFormField[] = [<ActionFormField>]
  /** State to be set for a user and action. This overrides existing state. See below for more information */
  state?: ActionState
  /** If there was an error in the form request, then set an error here for Looker to display in the UI and add to scheduler history*/
  error?: Error | string
}
```

Here's a TypeScript definition for all the options for a form field:

```ts
interface ActionFormField {
  /** (required) Name */
  name: string
  /** Human-readable label */
  label?: string
  /** Description of field */
  description?: string
  /** Type of field. Can be "text" | "textarea" | "select" */
  type?: string
  /** Default value of the field. */
  default?: string
  /** If true, Looker will re-query the form endpoint upon changes to this field by the end user. The current values of all fields will be sent with the request. This allows the action to dynamically alter the form contents based on user interaction, e.g. for faceted select box options. **/
  interactive?: boolean
  /** Whether or not the field is required. This is a user-interface hint. A user interface displaying this form should not submit it without a value for this field. The action server must also perform this validation. */
  required?: boolean
  /** If the form type is 'select', a list of options to be selected from. */
  options?: FormSelectOption[]
}

interface FormSelectOption {
  /** (required) Name */
  name: string
  /** Human-readable label */
  label?: string
}
```

For OAuth-enabled actions, there is a special form response for when the user is not yet authenticated to the external system. This prompts Looker to display a login button instead:

```ts
interface ActionFormFieldOAuth extends ActionFormField {
  type: "oauth_link"
  oauth_url: string
}
```

Your service will need to expose additional endpoints that implement the OAuth flow. Refer to the Action Hub source code for examples.

### Action User State

The action API is designed to keep each action independent from other actions. For certain actions - especially OAuth-enabled actions - state may be required per user. If there is state for a user and action, Looker sends the state as part of a `form` or `execute` request. If there is no state, the field is unused. If you wish to set state, you can provide a `state` property in an `execute` or `form` response. A refresh time may also be specified in seconds, which causes Looker to re-query the `form` endpoint for that user after the refresh time has elapsed (with a current maximum of once every 10 minutes). This can be used to keep authentication credentials up-to-date or to simply store some state for the user+action combination within the Looker server.

Here is the definition of the `state` field: 
```ts
class ActionState {
    /** Data is a string up to 32KB that can be saved on the Looker server. This data is encrypted by the Looker server and only read out when an action requests it. If data is set to nil then the state will be wiped on the Looker server. */
    data?: string
    /** refresh_time is a time in seconds that the state will automatically send `form` requests for the action. */
    refresh_time?: number
}
```

## Authentication

When an administrator adds the Action Hub URL to Looker, they can also optionally provide an authentication token. When Looker sends a request to any of the endpoints it will also include this token in the header. You can use this to refuse access to unauthorized requests, or provide different behavior to different tokens.

The token is provided as a standard HTTP `Authorization` header with a `token` like so:

```
Authorization: Token token="abcdefg123456789"
```

Each individual action can also specify additional options or credentials as part of its `params`. This is useful if you need different secrets or global configurations for each action.
