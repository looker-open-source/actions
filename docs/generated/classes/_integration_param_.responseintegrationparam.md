[looker-action-hub](../README.md) > ["integration_param"](../modules/_integration_param_.md) > [ResponseIntegrationParam](../classes/_integration_param_.responseintegrationparam.md)



# Class: ResponseIntegrationParam

## Index

### Properties

* [description](_integration_param_.responseintegrationparam.md#description)
* [hasValue](_integration_param_.responseintegrationparam.md#hasvalue)
* [label](_integration_param_.responseintegrationparam.md#label)
* [name](_integration_param_.responseintegrationparam.md#name)
* [required](_integration_param_.responseintegrationparam.md#required)
* [sensitive](_integration_param_.responseintegrationparam.md#sensitive)
* [userAttributeName](_integration_param_.responseintegrationparam.md#userattributename)
* [value](_integration_param_.responseintegrationparam.md#value)



---
## Properties
<a id="description"></a>

###  description

**●  description**:  *`string`⎮`null`* 




Short description of the parameter.




___

<a id="hasvalue"></a>

###  hasValue

**●  hasValue**:  *`boolean`* 




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

<a id="userattributename"></a>

###  userAttributeName

**●  userAttributeName**:  *`string`⎮`null`* 




When present, the param's value comes from this user attribute instead of the 'value' parameter. Set to null to use the 'value'.




___

<a id="value"></a>

###  value

**●  value**:  *`string`⎮`null`* 




The current value of the parameter. Always null if the value is sensitive. When writing, null values will be ignored. Set the value to an empty string to clear it.




___


