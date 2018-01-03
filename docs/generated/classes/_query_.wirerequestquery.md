[looker-action-hub](../README.md) > ["query"](../modules/_query_.md) > [WireRequestQuery](../classes/_query_.wirerequestquery.md)



# Class: WireRequestQuery

## Index

### Properties

* [client_id](_query_.wirerequestquery.md#client_id)
* [column_limit](_query_.wirerequestquery.md#column_limit)
* [dynamic_fields](_query_.wirerequestquery.md#dynamic_fields)
* [fields](_query_.wirerequestquery.md#fields)
* [fill_fields](_query_.wirerequestquery.md#fill_fields)
* [filter_config](_query_.wirerequestquery.md#filter_config)
* [filter_expression](_query_.wirerequestquery.md#filter_expression)
* [filters](_query_.wirerequestquery.md#filters)
* [limit](_query_.wirerequestquery.md#limit)
* [model](_query_.wirerequestquery.md#model)
* [pivots](_query_.wirerequestquery.md#pivots)
* [query_timezone](_query_.wirerequestquery.md#query_timezone)
* [row_total](_query_.wirerequestquery.md#row_total)
* [runtime](_query_.wirerequestquery.md#runtime)
* [sorts](_query_.wirerequestquery.md#sorts)
* [total](_query_.wirerequestquery.md#total)
* [view](_query_.wirerequestquery.md#view)
* [vis_config](_query_.wirerequestquery.md#vis_config)
* [visible_ui_sections](_query_.wirerequestquery.md#visible_ui_sections)



---
## Properties
<a id="client_id"></a>

### «Optional» client_id

**●  client_id**:  *`string`⎮`null`* 




Client Id: used to generate shortened explore URLs. If set by client, must be a unique 22 character alphanumeric string. Otherwise one will be generated.




___

<a id="column_limit"></a>

### «Optional» column_limit

**●  column_limit**:  *`string`⎮`null`* 




Column Limit




___

<a id="dynamic_fields"></a>

### «Optional» dynamic_fields

**●  dynamic_fields**:  *`any`[]⎮`null`* 




Dynamic Fields




___

<a id="fields"></a>

### «Optional» fields

**●  fields**:  *`string`[]⎮`null`* 




Fields




___

<a id="fill_fields"></a>

### «Optional» fill_fields

**●  fill_fields**:  *`string`[]⎮`null`* 




Fill Fields




___

<a id="filter_config"></a>

### «Optional» filter_config

**●  filter_config**:  *`object`⎮`null`* 




The filter_config represents the state of the filter UI on the explore page for a given query. When running a query via the Looker UI, this parameter takes precedence over "filters". When creating a query or modifying an existing query, "filter_config" should be set to null. Setting it to any other value could cause unexpected filtering behavior. The format should be considered opaque.




___

<a id="filter_expression"></a>

### «Optional» filter_expression

**●  filter_expression**:  *`string`⎮`null`* 




Filter Expression




___

<a id="filters"></a>

### «Optional» filters

**●  filters**:  *`object`⎮`null`* 




Filters




___

<a id="limit"></a>

### «Optional» limit

**●  limit**:  *`string`⎮`null`* 




Limit




___

<a id="model"></a>

### «Optional» model

**●  model**:  *`undefined`⎮`string`* 




Model




___

<a id="pivots"></a>

### «Optional» pivots

**●  pivots**:  *`string`[]⎮`null`* 




Pivots




___

<a id="query_timezone"></a>

### «Optional» query_timezone

**●  query_timezone**:  *`string`⎮`null`* 




Query Timezone




___

<a id="row_total"></a>

### «Optional» row_total

**●  row_total**:  *`string`⎮`null`* 




Raw Total




___

<a id="runtime"></a>

### «Optional» runtime

**●  runtime**:  *`number`⎮`null`* 




Runtime




___

<a id="sorts"></a>

### «Optional» sorts

**●  sorts**:  *`string`[]⎮`null`* 




Sorts




___

<a id="total"></a>

### «Optional» total

**●  total**:  *`undefined`⎮`true`⎮`false`* 




Total




___

<a id="view"></a>

### «Optional» view

**●  view**:  *`undefined`⎮`string`* 




View




___

<a id="vis_config"></a>

### «Optional» vis_config

**●  vis_config**:  *`object`⎮`null`* 




Visualization configuration properties. These properties are typically opaque and differ based on the type of visualization used. There is no specified set of allowed keys. The values can be any type supported by JSON. A "type" key with a string value is often present, and is used by Looker to determine which visualization to present. Visualizations ignore unknown vis_config properties.




___

<a id="visible_ui_sections"></a>

### «Optional» visible_ui_sections

**●  visible_ui_sections**:  *`string`⎮`null`* 




Visible UI Sections




___


