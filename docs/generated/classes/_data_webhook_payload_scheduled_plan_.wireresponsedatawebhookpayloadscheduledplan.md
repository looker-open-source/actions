[looker-action-hub](../README.md) > ["data_webhook_payload_scheduled_plan"](../modules/_data_webhook_payload_scheduled_plan_.md) > [WireResponseDataWebhookPayloadScheduledPlan](../classes/_data_webhook_payload_scheduled_plan_.wireresponsedatawebhookpayloadscheduledplan.md)



# Class: WireResponseDataWebhookPayloadScheduledPlan

## Index

### Properties

* [filters_differ_from_look](_data_webhook_payload_scheduled_plan_.wireresponsedatawebhookpayloadscheduledplan.md#filters_differ_from_look)
* [query](_data_webhook_payload_scheduled_plan_.wireresponsedatawebhookpayloadscheduledplan.md#query)
* [query_id](_data_webhook_payload_scheduled_plan_.wireresponsedatawebhookpayloadscheduledplan.md#query_id)
* [scheduled_plan_id](_data_webhook_payload_scheduled_plan_.wireresponsedatawebhookpayloadscheduledplan.md#scheduled_plan_id)
* [title](_data_webhook_payload_scheduled_plan_.wireresponsedatawebhookpayloadscheduledplan.md#title)
* [type](_data_webhook_payload_scheduled_plan_.wireresponsedatawebhookpayloadscheduledplan.md#type)
* [url](_data_webhook_payload_scheduled_plan_.wireresponsedatawebhookpayloadscheduledplan.md#url)



---
## Properties
<a id="filters_differ_from_look"></a>

###  filters_differ_from_look

**●  filters_differ_from_look**:  *`boolean`* 




A boolean representing whether this schedule payload has customized the filter values compared to the underlying content item.




___

<a id="query"></a>

###  query

**●  query**:  *[WireResponseQuery](_query_.wireresponsequery.md)⎮`null`* 




Query that was run (not available for dashboards)




___

<a id="query_id"></a>

###  query_id

**●  query_id**:  *`number`⎮`null`* 




ID of the query that the data payload represents.




___

<a id="scheduled_plan_id"></a>

###  scheduled_plan_id

**●  scheduled_plan_id**:  *`number`⎮`null`* 




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


