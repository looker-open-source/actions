[looker-action-hub](../README.md) > ["query"](../modules/_query_.md) > [RequestQuery](../classes/_query_.requestquery.md)



# Class: RequestQuery

## Index

### Properties

* [clientId](_query_.requestquery.md#clientid)
* [columnLimit](_query_.requestquery.md#columnlimit)
* [dynamicFields](_query_.requestquery.md#dynamicfields)
* [fields](_query_.requestquery.md#fields)
* [fillFields](_query_.requestquery.md#fillfields)
* [filterConfig](_query_.requestquery.md#filterconfig)
* [filterExpression](_query_.requestquery.md#filterexpression)
* [filters](_query_.requestquery.md#filters)
* [limit](_query_.requestquery.md#limit)
* [model](_query_.requestquery.md#model)
* [pivots](_query_.requestquery.md#pivots)
* [queryTimezone](_query_.requestquery.md#querytimezone)
* [rowTotal](_query_.requestquery.md#rowtotal)
* [runtime](_query_.requestquery.md#runtime)
* [sorts](_query_.requestquery.md#sorts)
* [total](_query_.requestquery.md#total)
* [view](_query_.requestquery.md#view)
* [visConfig](_query_.requestquery.md#visconfig)
* [visibleUiSections](_query_.requestquery.md#visibleuisections)



---
## Properties
<a id="clientid"></a>

### «Optional» clientId

**●  clientId**:  *`string`⎮`null`* 




Client Id: used to generate shortened explore URLs. If set by client, must be a unique 22 character alphanumeric string. Otherwise one will be generated.




___

<a id="columnlimit"></a>

### «Optional» columnLimit

**●  columnLimit**:  *`string`⎮`null`* 




Column Limit




___

<a id="dynamicfields"></a>

### «Optional» dynamicFields

**●  dynamicFields**:  *`any`[]⎮`null`* 




Dynamic Fields




___

<a id="fields"></a>

### «Optional» fields

**●  fields**:  *`string`[]⎮`null`* 




Fields




___

<a id="fillfields"></a>

### «Optional» fillFields

**●  fillFields**:  *`string`[]⎮`null`* 




Fill Fields




___

<a id="filterconfig"></a>

### «Optional» filterConfig

**●  filterConfig**:  *`object`⎮`null`* 




The filter_config represents the state of the filter UI on the explore page for a given query. When running a query via the Looker UI, this parameter takes precedence over "filters". When creating a query or modifying an existing query, "filter_config" should be set to null. Setting it to any other value could cause unexpected filtering behavior. The format should be considered opaque.




___

<a id="filterexpression"></a>

### «Optional» filterExpression

**●  filterExpression**:  *`string`⎮`null`* 




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

<a id="querytimezone"></a>

### «Optional» queryTimezone

**●  queryTimezone**:  *`string`⎮`null`* 




Query Timezone




___

<a id="rowtotal"></a>

### «Optional» rowTotal

**●  rowTotal**:  *`string`⎮`null`* 




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

<a id="visconfig"></a>

### «Optional» visConfig

**●  visConfig**:  *`object`⎮`null`* 




Visualization configuration properties. These properties are typically opaque and differ based on the type of visualization used. There is no specified set of allowed keys. The values can be any type supported by JSON. A "type" key with a string value is often present, and is used by Looker to determine which visualization to present. Visualizations ignore unknown vis_config properties.




___

<a id="visibleuisections"></a>

### «Optional» visibleUiSections

**●  visibleUiSections**:  *`string`⎮`null`* 




Visible UI Sections




___


