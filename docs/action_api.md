# Looker Action API

To build an action directly into an existing web service in any language, you can easily have your server implement our Action API directly.

The Action API is a simple webhook-like API to accept actions from Looker. Your server will provide a few endpoints that Looker can connect to to list and execute actions.

By implementing the Action API your server becomes an "Action Hub" that users can connect Looker to. An Action Hub can expose one or more actions.

## Endpoints

In order to implement the Action API your server will need to expose a few endpoints for Looker to connect to:

- [Actions List Endpoint](#actions-list-endpoint)

  This endpoint lists all the actions your hub exposes. Each listed action contains metadata instructing Looker how to execute your action. It indicates what data payload formats are supported, what information (if any) to collect from the Looker administrator (such as API keys), and if the action also has an end-user facing Action Form.

  The URL of this endpoint is entered into the Looker admin panel (as the "Action Hub URL") and is how users connect to your action hub.

- [Action Execute Endpoint](#action-execute-endpoint)

  This is the endpoint that Looker will send the payload, form information, and other metadata in order to execute a given action. This is the main implementation of your action. This endpoint works the same way as a Looker Webhook endpoint.

- (optional) [Action Form Endpoint](#action-form-endpoint)

  If the action's definition specifies a form, Looker will ask this endpoint for a form template that should be displayed to the end user to configure the action. Since Looker will ask this endpoint for the form every time it's displayed, it's possible to dynamically change the form based on whatever information you like. For example, in a chat application the form might dynamically list all the available chat channels that data can be sent to.

Each of these endpoints can optionally perform [authentication](#authentication) with an API key.

### Actions List Endpoint

Looker will send an HTTP POST request with an empty body to this endpoint.

The endpoint should return a JSON payload with an `integrations` key containing a list of actions.

Here's an example of a list containing a single integration:

```json
{
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
  /** (required) An array of action definition objects. */
  integrations: ActionDefinition[]
}

interface ActionDefinition {
  /** (required) A unique name for the action. This should be unique across all actions in the hub. */
  name: string
  /** (required) An absolute URL of the execute endpoint for this action. */
  url: string
  /** (required) A human-readable label for the action. */
  label: string
  /** (required) A list of action types the action supports. Valid values are: "cell", "query", "dashboard". */
  supported_action_types: string[]

  /** An absolute URL of the form endpoint for this action. */
  form_url?: string
  /** Description of the action. */
  description?: string
  /** Array of params for the action. */
  params?: Param[]
  /** A list of data formats the action supports. Valid values are: "txt", "csv", "inline_json", "json", "json_detail", "json_detail_lite_stream", "xlsx", "html", "wysiwyg_pdf", "assembled_pdf", "wysiwyg_png". */
  supported_formats?: string[]
  /** A list of formatting options the action supports. Valid values are: "formatted", "unformatted". */
  supported_formattings?: string[]
  /** A list of visualization formatting options the action supports. Valid values are: "apply", "noapply". */
  supported_visualization_formattings?: string[]
  /** A Data URI reprensenting an icon image for the action. */
  icon_data_uri?: string
  /** A list of descriptions of required fields that this action is compatible with. If there are multiple entries in this list, the action requires more than one field. */
  required_fields?: RequiredField[]
  /** A boolean that determines whether or not the action will be sent a one time use download url to faciliate unlimited streaming of data */
  supported_download_settings: boolean
  /** A boolean that determines whether action is an oauth action or not. This will change whether or not the action will be sent a one time use link to be able to set state for a specific user for this action */
  uses_oauth: boolean
}

interface Param {
  /** (required) Name of the parameter. */
  name: string
  /** (required) Label of the parameter. */
  label: string

  /** Short description of the parameter. */
  description?: string
  /** Whether the parameter is required to be set to use the action. (default: false) */
  required?: boolean
  /** Whether the parameter contains sensitive data like API credentials. (default: true) */
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

When the user initiates an action (either manually or by scheduling it), Looker will run the relevant query and then POST the data to the execute endpoint.

The payload sent to this endpoint is always JSON and it's always sent using [chunked transfer encoding](https://en.wikipedia.org/wiki/Chunked_transfer_encoding) to facilitate streaming data from the analytic database.

The payload format here is the same as the Looker Webhook format which is as follows:

```ts
interface ExecutePayload {
  /** The type of data payload. Valid values are: "cell", "query", "dashboard". */
  type: string
  /** The associated scheduled plan, if this payload is on a schedule. */
  scheduled_plan: ExecutePayloadScheduledPlan | null
  /** Attached data, if the payload data is a file. */
  attachment: ExecutePayloadAttachment | null
  /** Data, if the payload data is in an inline format. */
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

When the user initiates an action, if `form_url` was defined in the action definition, Looker will request the form endpoint by sending a POST request with an empty body. For scheduled actions, the form information will be collected from the user at the time the schedule is set up. Otherwise, it's collected immediately before executing the action.

The endpoint should return the structure of a form that Looker will display to the user. When the action executes, the user's responses will appear in the `form_params` part of the payload. Form parameters are always strings. Your action implementation can parse those strings into numbers or whatever else you like.

The form body is a JSON array of form fields:

```json
[
  {"name": "myformparam", "label": "My Form Param"},
  {"name": "body", "label": "Body Text", "type": "textarea"}
]
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

### Action User State

The action hub API is designed to keep each action independent from previous actions. For certain actions though (OAuth enabled actions being an example) - state may be required per user. If there is state for a user and action - then Looker will send the state as part of a `form` or `execute` request. If there is no state then the field is unused. If you wish to set state it can be accomplished using the `state` field on an `execute` or `form` response. Refresh time may also be specified in seconds (a refresh on state will make a state request), although the Looker server currently will only look for new refresh states once every 10 minutes. This can be used to keep authentication credentials up to date or to simply keep some state up to date on the Looker server for the user and action. 
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

When the user inputs the Action Hub URL into Looker, they can also optionally provide an authentication token. When Looker sends a request to any of the endpoints, it will pass the authentication token back to your server. You can use this to refuse access to unauthorized users, or provide different behavior to different tokens.

The token is provided as a standard HTTP `Authorization` header with a `token` like this:

```
Authorization: Token token="abcdefg123456789"
```

Each individual action can also specify additional options or credentials as part of its `params`. This is useful if you need different authorization tokens for each action.
