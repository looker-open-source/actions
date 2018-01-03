[looker-action-hub](../README.md) > ["integration_param"](../modules/_integration_param_.md) > [RequestIntegrationParam](../classes/_integration_param_.requestintegrationparam.md)



# Class: RequestIntegrationParam

## Index

### Properties

* [userAttributeName](_integration_param_.requestintegrationparam.md#userattributename)
* [value](_integration_param_.requestintegrationparam.md#value)



---
## Properties
<a id="userattributename"></a>

### «Optional» userAttributeName

**●  userAttributeName**:  *`string`⎮`null`* 




When present, the param's value comes from this user attribute instead of the 'value' parameter. Set to null to use the 'value'.




___

<a id="value"></a>

### «Optional» value

**●  value**:  *`string`⎮`null`* 




The current value of the parameter. Always null if the value is sensitive. When writing, null values will be ignored. Set the value to an empty string to clear it.




___


