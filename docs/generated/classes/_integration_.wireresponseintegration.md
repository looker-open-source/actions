[looker-action-hub](../README.md) > ["integration"](../modules/_integration_.md) > [WireResponseIntegration](../classes/_integration_.wireresponseintegration.md)



# Class: WireResponseIntegration

## Index

### Properties

* [can](_integration_.wireresponseintegration.md#can)
* [description](_integration_.wireresponseintegration.md#description)
* [enabled](_integration_.wireresponseintegration.md#enabled)
* [icon_url](_integration_.wireresponseintegration.md#icon_url)
* [id](_integration_.wireresponseintegration.md#id)
* [integration_hub_id](_integration_.wireresponseintegration.md#integration_hub_id)
* [label](_integration_.wireresponseintegration.md#label)
* [params](_integration_.wireresponseintegration.md#params)
* [required_fields](_integration_.wireresponseintegration.md#required_fields)
* [supported_action_types](_integration_.wireresponseintegration.md#supported_action_types)
* [supported_formats](_integration_.wireresponseintegration.md#supported_formats)
* [supported_formattings](_integration_.wireresponseintegration.md#supported_formattings)
* [supported_visualization_formattings](_integration_.wireresponseintegration.md#supported_visualization_formattings)



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

<a id="icon_url"></a>

###  icon_url

**●  icon_url**:  *`string`⎮`null`* 




URL to an icon for the integration.




___

<a id="id"></a>

###  id

**●  id**:  *`string`* 




ID of the integration.




___

<a id="integration_hub_id"></a>

###  integration_hub_id

**●  integration_hub_id**:  *`number`* 




ID of the integration hub.




___

<a id="label"></a>

###  label

**●  label**:  *`string`* 




Label for the integration.




___

<a id="params"></a>

###  params

**●  params**:  *[WireResponseIntegrationParam](_integration_param_.wireresponseintegrationparam.md)[]* 




Array of params for the integration.




___

<a id="required_fields"></a>

###  required_fields

**●  required_fields**:  *[WireResponseIntegrationRequiredField](_integration_required_field_.wireresponseintegrationrequiredfield.md)[]* 




A list of descriptions of required fields that this integration is compatible with. If there are multiple entries in this list, the integration requires more than one field.




___

<a id="supported_action_types"></a>

###  supported_action_types

**●  supported_action_types**:  *[IntegrationSupportedActionTypes](../enums/_integration_.integrationsupportedactiontypes.md)[]* 




A list of action types the integration supports. Valid values are: "cell", "query", "dashboard".




___

<a id="supported_formats"></a>

###  supported_formats

**●  supported_formats**:  *[IntegrationSupportedFormats](../enums/_integration_.integrationsupportedformats.md)[]* 




A list of data formats the integration supports. Valid values are: "txt", "csv", "inline_json", "json", "json_detail", "xlsx", "html", "wysiwyg_pdf", "assembled_pdf", "wysiwyg_png".




___

<a id="supported_formattings"></a>

###  supported_formattings

**●  supported_formattings**:  *[IntegrationSupportedFormattings](../enums/_integration_.integrationsupportedformattings.md)[]* 




A list of formatting options the integration supports. Valid values are: "formatted", "unformatted".




___

<a id="supported_visualization_formattings"></a>

###  supported_visualization_formattings

**●  supported_visualization_formattings**:  *[IntegrationSupportedVisualizationFormattings](../enums/_integration_.integrationsupportedvisualizationformattings.md)[]* 




A list of visualization formatting options the integration supports. Valid values are: "apply", "noapply".




___


