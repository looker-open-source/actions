[looker-action-hub](../README.md) > ["integration_param"](../modules/_integration_param_.md) > [WireRequestIntegrationParam](../classes/_integration_param_.wirerequestintegrationparam.md)



# Class: WireRequestIntegrationParam

## Index

### Properties

* [user_attribute_name](_integration_param_.wirerequestintegrationparam.md#user_attribute_name)
* [value](_integration_param_.wirerequestintegrationparam.md#value)



---
## Properties
<a id="user_attribute_name"></a>

### «Optional» user_attribute_name

**●  user_attribute_name**:  *`string`⎮`null`* 




When present, the param's value comes from this user attribute instead of the 'value' parameter. Set to null to use the 'value'.




___

<a id="value"></a>

### «Optional» value

**●  value**:  *`string`⎮`null`* 




The current value of the parameter. Always null if the value is sensitive. When writing, null values will be ignored. Set the value to an empty string to clear it.




___


