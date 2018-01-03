[looker-action-hub](../README.md) > ["data_webhook_payload_scheduled_plan"](../modules/_data_webhook_payload_scheduled_plan_.md) > [ResponseDataWebhookPayloadScheduledPlan](../classes/_data_webhook_payload_scheduled_plan_.responsedatawebhookpayloadscheduledplan.md)



# Class: ResponseDataWebhookPayloadScheduledPlan

## Index

### Properties

* [filtersDifferFromLook](_data_webhook_payload_scheduled_plan_.responsedatawebhookpayloadscheduledplan.md#filtersdifferfromlook)
* [query](_data_webhook_payload_scheduled_plan_.responsedatawebhookpayloadscheduledplan.md#query)
* [queryId](_data_webhook_payload_scheduled_plan_.responsedatawebhookpayloadscheduledplan.md#queryid)
* [scheduledPlanId](_data_webhook_payload_scheduled_plan_.responsedatawebhookpayloadscheduledplan.md#scheduledplanid)
* [title](_data_webhook_payload_scheduled_plan_.responsedatawebhookpayloadscheduledplan.md#title)
* [type](_data_webhook_payload_scheduled_plan_.responsedatawebhookpayloadscheduledplan.md#type)
* [url](_data_webhook_payload_scheduled_plan_.responsedatawebhookpayloadscheduledplan.md#url)



---
## Properties
<a id="filtersdifferfromlook"></a>

###  filtersDifferFromLook

**●  filtersDifferFromLook**:  *`boolean`* 




A boolean representing whether this schedule payload has customized the filter values compared to the underlying content item.




___

<a id="query"></a>

###  query

**●  query**:  *[ResponseQuery](_query_.responsequery.md)⎮`null`* 




Query that was run (not available for dashboards)




___

<a id="queryid"></a>

###  queryId

**●  queryId**:  *`number`⎮`null`* 




ID of the query that the data payload represents.




___

<a id="scheduledplanid"></a>

###  scheduledPlanId

**●  scheduledPlanId**:  *`number`⎮`null`* 




ID of the scheduled plan




___

<a id="title"></a>

###  title

**●  title**:  *`string`⎮`null`* 




Title of the scheduled plan.




___

<a id="type"></a>

###  type

**●  type**:  *[DataWebhookPayloadScheduledPlanType](../enums/_data_webhook_payload_scheduled_plan_.datawebhookpayloadscheduledplantype.md)* 




Type of content of the scheduled plan. Valid values are: "Look", "Dashboard".




___

<a id="url"></a>

###  url

**●  url**:  *`string`⎮`null`* 




URL of the content item in Looker.




___


