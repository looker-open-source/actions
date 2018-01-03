[looker-action-hub](../README.md) > ["query"](../modules/_query_.md) > [ResponseQuery](../classes/_query_.responsequery.md)



# Class: ResponseQuery

## Index

### Properties

* [can](_query_.responsequery.md#can)
* [clientId](_query_.responsequery.md#clientid)
* [columnLimit](_query_.responsequery.md#columnlimit)
* [dynamicFields](_query_.responsequery.md#dynamicfields)
* [expandedShareUrl](_query_.responsequery.md#expandedshareurl)
* [fields](_query_.responsequery.md#fields)
* [fillFields](_query_.responsequery.md#fillfields)
* [filterConfig](_query_.responsequery.md#filterconfig)
* [filterExpression](_query_.responsequery.md#filterexpression)
* [filters](_query_.responsequery.md#filters)
* [hasTableCalculations](_query_.responsequery.md#hastablecalculations)
* [id](_query_.responsequery.md#id)
* [limit](_query_.responsequery.md#limit)
* [model](_query_.responsequery.md#model)
* [pivots](_query_.responsequery.md#pivots)
* [queryTimezone](_query_.responsequery.md#querytimezone)
* [rowTotal](_query_.responsequery.md#rowtotal)
* [runtime](_query_.responsequery.md#runtime)
* [shareUrl](_query_.responsequery.md#shareurl)
* [slug](_query_.responsequery.md#slug)
* [sorts](_query_.responsequery.md#sorts)
* [total](_query_.responsequery.md#total)
* [url](_query_.responsequery.md#url)
* [view](_query_.responsequery.md#view)
* [visConfig](_query_.responsequery.md#visconfig)
* [visibleUiSections](_query_.responsequery.md#visibleuisections)



---
## Properties
<a id="can"></a>

###  can

**●  can**:  *`object`* 




Operations the current user is able to perform on this object

#### Type declaration


[key: `string`]: `boolean`






___

<a id="clientid"></a>

###  clientId

**●  clientId**:  *`string`⎮`null`* 




Client Id: used to generate shortened explore URLs. If set by client, must be a unique 22 character alphanumeric string. Otherwise one will be generated.




___

<a id="columnlimit"></a>

###  columnLimit

**●  columnLimit**:  *`string`⎮`null`* 




Column Limit




___

<a id="dynamicfields"></a>

###  dynamicFields

**●  dynamicFields**:  *`any`[]⎮`null`* 




Dynamic Fields




___

<a id="expandedshareurl"></a>

###  expandedShareUrl

**●  expandedShareUrl**:  *`string`⎮`null`* 




Expanded Share Url




___

<a id="fields"></a>

###  fields

**●  fields**:  *`string`[]⎮`null`* 




Fields




___

<a id="fillfields"></a>

###  fillFields

**●  fillFields**:  *`string`[]⎮`null`* 




Fill Fields




___

<a id="filterconfig"></a>

###  filterConfig

**●  filterConfig**:  *`object`⎮`null`* 




The filter_config represents the state of the filter UI on the explore page for a given query. When running a query via the Looker UI, this parameter takes precedence over "filters". When creating a query or modifying an existing query, "filter_config" should be set to null. Setting it to any other value could cause unexpected filtering behavior. The format should be considered opaque.




___

<a id="filterexpression"></a>

###  filterExpression

**●  filterExpression**:  *`string`⎮`null`* 




Filter Expression




___

<a id="filters"></a>

###  filters

**●  filters**:  *`object`⎮`null`* 




Filters




___

<a id="hastablecalculations"></a>

###  hasTableCalculations

**●  hasTableCalculations**:  *`boolean`* 




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

<a id="querytimezone"></a>

###  queryTimezone

**●  queryTimezone**:  *`string`⎮`null`* 




Query Timezone




___

<a id="rowtotal"></a>

###  rowTotal

**●  rowTotal**:  *`string`⎮`null`* 




Raw Total




___

<a id="runtime"></a>

###  runtime

**●  runtime**:  *`number`⎮`null`* 




Runtime




___

<a id="shareurl"></a>

###  shareUrl

**●  shareUrl**:  *`string`⎮`null`* 




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

<a id="visconfig"></a>

###  visConfig

**●  visConfig**:  *`object`⎮`null`* 




Visualization configuration properties. These properties are typically opaque and differ based on the type of visualization used. There is no specified set of allowed keys. The values can be any type supported by JSON. A "type" key with a string value is often present, and is used by Looker to determine which visualization to present. Visualizations ignore unknown vis_config properties.




___

<a id="visibleuisections"></a>

###  visibleUiSections

**●  visibleUiSections**:  *`string`⎮`null`* 




Visible UI Sections




___


