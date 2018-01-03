[looker-action-hub](../README.md) > ["integration_param"](../modules/_integration_param_.md) > [WireResponseIntegrationParam](../classes/_integration_param_.wireresponseintegrationparam.md)



# Class: WireResponseIntegrationParam

## Index

### Properties

* [description](_integration_param_.wireresponseintegrationparam.md#description)
* [has_value](_integration_param_.wireresponseintegrationparam.md#has_value)
* [label](_integration_param_.wireresponseintegrationparam.md#label)
* [name](_integration_param_.wireresponseintegrationparam.md#name)
* [required](_integration_param_.wireresponseintegrationparam.md#required)
* [sensitive](_integration_param_.wireresponseintegrationparam.md#sensitive)
* [user_attribute_name](_integration_param_.wireresponseintegrationparam.md#user_attribute_name)
* [value](_integration_param_.wireresponseintegrationparam.md#value)



---
## Properties
<a id="description"></a>

###  description

**●  description**:  *`string`⎮`null`* 




Short description of the parameter.




___

<a id="has_value"></a>

###  has_value

**●  has_value**:  *`boolean`* 




Whether the parameter has a value set.




___

<a id="label"></a>

###  label

**●  label**:  *`string`⎮`null`* 




Label of the parameter.




___

<a id="name"></a>

###  name

**●  name**:  *`string`⎮`null`* 




Name of the parameter.




___

<a id="required"></a>

###  required

**●  required**:  *`boolean`* 




Whether the parameter is required to be set to use the destination.




___

<a id="sensitive"></a>

###  sensitive

**●  sensitive**:  *`boolean`* 




Whether the parameter contains sensitive data like API credentials.




___

<a id="user_attribute_name"></a>

###  user_attribute_name

**●  user_attribute_name**:  *`string`⎮`null`* 




When present, the param's value comes from this user attribute instead of the 'value' parameter. Set to null to use the 'value'.




___

<a id="value"></a>

###  value

**●  value**:  *`string`⎮`null`* 




The current value of the parameter. Always null if the value is sensitive. When writing, null values will be ignored. Set the value to an empty string to clear it.




___


