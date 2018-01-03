[looker-action-hub](../README.md) > ["data_webhook_payload"](../modules/_data_webhook_payload_.md) > [WireResponseDataWebhookPayload](../classes/_data_webhook_payload_.wireresponsedatawebhookpayload.md)



# Class: WireResponseDataWebhookPayload

## Index

### Properties

* [attachment](_data_webhook_payload_.wireresponsedatawebhookpayload.md#attachment)
* [data](_data_webhook_payload_.wireresponsedatawebhookpayload.md#data)
* [form_params](_data_webhook_payload_.wireresponsedatawebhookpayload.md#form_params)
* [scheduled_plan](_data_webhook_payload_.wireresponsedatawebhookpayload.md#scheduled_plan)
* [type](_data_webhook_payload_.wireresponsedatawebhookpayload.md#type)



---
## Properties
<a id="attachment"></a>

###  attachment

**●  attachment**:  *[WireResponseDataWebhookPayloadAttachment](_data_webhook_payload_attachment_.wireresponsedatawebhookpayloadattachment.md)⎮`null`* 




Attached data, if the payload data is a file.




___

<a id="data"></a>

###  data

**●  data**:  *`object`⎮`null`* 




Data, if the payload data is in an inline format.




___

<a id="form_params"></a>

###  form_params

**●  form_params**:  *`object`⎮`null`* 




Form parameters associated with the payload.




___

<a id="scheduled_plan"></a>

###  scheduled_plan

**●  scheduled_plan**:  *[WireResponseDataWebhookPayloadScheduledPlan](_data_webhook_payload_scheduled_plan_.wireresponsedatawebhookpayloadscheduledplan.md)⎮`null`* 




The associated scheduled plan, if this payload is on a schedule.




___

<a id="type"></a>

###  type

**●  type**:  *[DataWebhookPayloadType](../enums/_data_webhook_payload_.datawebhookpayloadtype.md)⎮`null`* 




The type of data payload. Valid values are: "cell", "query", "dashboard".




___


