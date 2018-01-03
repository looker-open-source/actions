[looker-action-hub](../README.md) > ["integration"](../modules/_integration_.md) > [ResponseIntegration](../classes/_integration_.responseintegration.md)



# Class: ResponseIntegration

## Index

### Properties

* [can](_integration_.responseintegration.md#can)
* [description](_integration_.responseintegration.md#description)
* [enabled](_integration_.responseintegration.md#enabled)
* [iconUrl](_integration_.responseintegration.md#iconurl)
* [id](_integration_.responseintegration.md#id)
* [integrationHubId](_integration_.responseintegration.md#integrationhubid)
* [label](_integration_.responseintegration.md#label)
* [params](_integration_.responseintegration.md#params)
* [requiredFields](_integration_.responseintegration.md#requiredfields)
* [supportedActionTypes](_integration_.responseintegration.md#supportedactiontypes)
* [supportedFormats](_integration_.responseintegration.md#supportedformats)
* [supportedFormattings](_integration_.responseintegration.md#supportedformattings)
* [supportedVisualizationFormattings](_integration_.responseintegration.md#supportedvisualizationformattings)



---
## Properties
<a id="can"></a>

###  can

**●  can**:  *`object`* 




Operations the current user is able to perform on this object

#### Type declaration


[key: `string`]: `boolean`






___

<a id="description"></a>

###  description

**●  description**:  *`string`⎮`null`* 




Description of the integration.




___

<a id="enabled"></a>

###  enabled

**●  enabled**:  *`boolean`* 




Whether the integration is available to users.




___

<a id="iconurl"></a>

###  iconUrl

**●  iconUrl**:  *`string`⎮`null`* 




URL to an icon for the integration.




___

<a id="id"></a>

###  id

**●  id**:  *`string`* 




ID of the integration.




___

<a id="integrationhubid"></a>

###  integrationHubId

**●  integrationHubId**:  *`number`* 




ID of the integration hub.




___

<a id="label"></a>

###  label

**●  label**:  *`string`* 




Label for the integration.




___

<a id="params"></a>

###  params

**●  params**:  *[ResponseIntegrationParam](_integration_param_.responseintegrationparam.md)[]* 




Array of params for the integration.




___

<a id="requiredfields"></a>

###  requiredFields

**●  requiredFields**:  *[ResponseIntegrationRequiredField](_integration_required_field_.responseintegrationrequiredfield.md)[]* 




A list of descriptions of required fields that this integration is compatible with. If there are multiple entries in this list, the integration requires more than one field.




___

<a id="supportedactiontypes"></a>

###  supportedActionTypes

**●  supportedActionTypes**:  *[IntegrationSupportedActionTypes](../enums/_integration_.integrationsupportedactiontypes.md)[]* 




A list of action types the integration supports. Valid values are: "cell", "query", "dashboard".




___

<a id="supportedformats"></a>

###  supportedFormats

**●  supportedFormats**:  *[IntegrationSupportedFormats](../enums/_integration_.integrationsupportedformats.md)[]* 




A list of data formats the integration supports. Valid values are: "txt", "csv", "inline_json", "json", "json_detail", "xlsx", "html", "wysiwyg_pdf", "assembled_pdf", "wysiwyg_png".




___

<a id="supportedformattings"></a>

###  supportedFormattings

**●  supportedFormattings**:  *[IntegrationSupportedFormattings](../enums/_integration_.integrationsupportedformattings.md)[]* 




A list of formatting options the integration supports. Valid values are: "formatted", "unformatted".




___

<a id="supportedvisualizationformattings"></a>

###  supportedVisualizationFormattings

**●  supportedVisualizationFormattings**:  *[IntegrationSupportedVisualizationFormattings](../enums/_integration_.integrationsupportedvisualizationformattings.md)[]* 




A list of visualization formatting options the integration supports. Valid values are: "apply", "noapply".




___


