[looker-action-hub](../README.md) > ["data_webhook_payload"](../modules/_data_webhook_payload_.md) > [ResponseDataWebhookPayload](../classes/_data_webhook_payload_.responsedatawebhookpayload.md)



# Class: ResponseDataWebhookPayload

## Index

### Properties

* [attachment](_data_webhook_payload_.responsedatawebhookpayload.md#attachment)
* [data](_data_webhook_payload_.responsedatawebhookpayload.md#data)
* [formParams](_data_webhook_payload_.responsedatawebhookpayload.md#formparams)
* [scheduledPlan](_data_webhook_payload_.responsedatawebhookpayload.md#scheduledplan)
* [type](_data_webhook_payload_.responsedatawebhookpayload.md#type)



---
## Properties
<a id="attachment"></a>

###  attachment

**●  attachment**:  *[ResponseDataWebhookPayloadAttachment](_data_webhook_payload_attachment_.responsedatawebhookpayloadattachment.md)⎮`null`* 




Attached data, if the payload data is a file.




___

<a id="data"></a>

###  data

**●  data**:  *`object`⎮`null`* 




Data, if the payload data is in an inline format.




___

<a id="formparams"></a>

###  formParams

**●  formParams**:  *`object`⎮`null`* 




Form parameters associated with the payload.




___

<a id="scheduledplan"></a>

###  scheduledPlan

**●  scheduledPlan**:  *[ResponseDataWebhookPayloadScheduledPlan](_data_webhook_payload_scheduled_plan_.responsedatawebhookpayloadscheduledplan.md)⎮`null`* 




The associated scheduled plan, if this payload is on a schedule.




___

<a id="type"></a>

###  type

**●  type**:  *[DataWebhookPayloadType](../enums/_data_webhook_payload_.datawebhookpayloadtype.md)⎮`null`* 




The type of data payload. Valid values are: "cell", "query", "dashboard".




___


