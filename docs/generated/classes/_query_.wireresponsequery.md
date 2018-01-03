[looker-action-hub](../README.md) > ["query"](../modules/_query_.md) > [WireResponseQuery](../classes/_query_.wireresponsequery.md)



# Class: WireResponseQuery

## Index

### Properties

* [can](_query_.wireresponsequery.md#can)
* [client_id](_query_.wireresponsequery.md#client_id)
* [column_limit](_query_.wireresponsequery.md#column_limit)
* [dynamic_fields](_query_.wireresponsequery.md#dynamic_fields)
* [expanded_share_url](_query_.wireresponsequery.md#expanded_share_url)
* [fields](_query_.wireresponsequery.md#fields)
* [fill_fields](_query_.wireresponsequery.md#fill_fields)
* [filter_config](_query_.wireresponsequery.md#filter_config)
* [filter_expression](_query_.wireresponsequery.md#filter_expression)
* [filters](_query_.wireresponsequery.md#filters)
* [has_table_calculations](_query_.wireresponsequery.md#has_table_calculations)
* [id](_query_.wireresponsequery.md#id)
* [limit](_query_.wireresponsequery.md#limit)
* [model](_query_.wireresponsequery.md#model)
* [pivots](_query_.wireresponsequery.md#pivots)
* [query_timezone](_query_.wireresponsequery.md#query_timezone)
* [row_total](_query_.wireresponsequery.md#row_total)
* [runtime](_query_.wireresponsequery.md#runtime)
* [share_url](_query_.wireresponsequery.md#share_url)
* [slug](_query_.wireresponsequery.md#slug)
* [sorts](_query_.wireresponsequery.md#sorts)
* [total](_query_.wireresponsequery.md#total)
* [url](_query_.wireresponsequery.md#url)
* [view](_query_.wireresponsequery.md#view)
* [vis_config](_query_.wireresponsequery.md#vis_config)
* [visible_ui_sections](_query_.wireresponsequery.md#visible_ui_sections)



---
## Properties
<a id="can"></a>

###  can

**●  can**:  *`object`* 




Operations the current user is able to perform on this object

#### Type declaration


[key: `string`]: `boolean`






___

<a id="client_id"></a>

###  client_id

**●  client_id**:  *`string`⎮`null`* 




Client Id: used to generate shortened explore URLs. If set by client, must be a unique 22 character alphanumeric string. Otherwise one will be generated.




___

<a id="column_limit"></a>

###  column_limit

**●  column_limit**:  *`string`⎮`null`* 




Column Limit




___

<a id="dynamic_fields"></a>

###  dynamic_fields

**●  dynamic_fields**:  *`any`[]⎮`null`* 




Dynamic Fields




___

<a id="expanded_share_url"></a>

###  expanded_share_url

**●  expanded_share_url**:  *`string`⎮`null`* 




Expanded Share Url




___

<a id="fields"></a>

###  fields

**●  fields**:  *`string`[]⎮`null`* 




Fields




___

<a id="fill_fields"></a>

###  fill_fields

**●  fill_fields**:  *`string`[]⎮`null`* 




Fill Fields




___

<a id="filter_config"></a>

###  filter_config

**●  filter_config**:  *`object`⎮`null`* 




The filter_config represents the state of the filter UI on the explore page for a given query. When running a query via the Looker UI, this parameter takes precedence over "filters". When creating a query or modifying an existing query, "filter_config" should be set to null. Setting it to any other value could cause unexpected filtering behavior. The format should be considered opaque.




___

<a id="filter_expression"></a>

###  filter_expression

**●  filter_expression**:  *`string`⎮`null`* 




Filter Expression




___

<a id="filters"></a>

###  filters

**●  filters**:  *`object`⎮`null`* 




Filters




___

<a id="has_table_calculations"></a>

###  has_table_calculations

**●  has_table_calculations**:  *`boolean`* 




Has Table Calculations




___

<a id="id"></a>

###  id

**●  id**:  *`number`* 




Unique Id




___

<a id="limit"></a>

###  limit

**●  limit**:  *`string`⎮`null`* 




Limit




___

<a id="model"></a>

###  model

**●  model**:  *`string`* 




Model




___

<a id="pivots"></a>

###  pivots

**●  pivots**:  *`string`[]⎮`null`* 




Pivots




___

<a id="query_timezone"></a>

###  query_timezone

**●  query_timezone**:  *`string`⎮`null`* 




Query Timezone




___

<a id="row_total"></a>

###  row_total

**●  row_total**:  *`string`⎮`null`* 




Raw Total




___

<a id="runtime"></a>

###  runtime

**●  runtime**:  *`number`⎮`null`* 




Runtime




___

<a id="share_url"></a>

###  share_url

**●  share_url**:  *`string`⎮`null`* 




Share Url




___

<a id="slug"></a>

###  slug

**●  slug**:  *`string`⎮`null`* 




Slug




___

<a id="sorts"></a>

###  sorts

**●  sorts**:  *`string`[]⎮`null`* 




Sorts




___

<a id="total"></a>

###  total

**●  total**:  *`boolean`* 




Total




___

<a id="url"></a>

###  url

**●  url**:  *`string`⎮`null`* 




Expanded Url




___

<a id="view"></a>

###  view

**●  view**:  *`string`* 




View




___

<a id="vis_config"></a>

###  vis_config

**●  vis_config**:  *`object`⎮`null`* 




Visualization configuration properties. These properties are typically opaque and differ based on the type of visualization used. There is no specified set of allowed keys. The values can be any type supported by JSON. A "type" key with a string value is often present, and is used by Looker to determine which visualization to present. Visualizations ignore unknown vis_config properties.




___

<a id="visible_ui_sections"></a>

###  visible_ui_sections

**●  visible_ui_sections**:  *`string`⎮`null`* 




Visible UI Sections




___


