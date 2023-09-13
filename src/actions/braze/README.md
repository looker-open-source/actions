# Braze
## Sends data to Braze via REST API
The Braze actions enables you to flag users within Braze via the [Rest API Endpoint](https://www.braze.com/docs/developer_guide/rest_api/user_data/#user-track-request) from a Looker look. This actions requires that a dimension is tagged with `braze_id`.  The action will append the flagged value to the user's `looker_export` custom attribute.  Standard and custom attributes can also be set by tagging the field with `braze[]` and the name of the attribute within `[]` ie `braze[NAMEOFATTRIBUTE]`.

**Only existing users will be flagged.**
**Does not work with pivoted data**

## Setup Instructions
  1. Create an Rest API key with access to `user.track` from the [Braze Developer Console](https://dashboard.braze.com/app_settings/developer_console/) ![](braze_api_key.png)
  2. Setup the Braze Looker Action with the API Key, and [Braze Rest Endpoint](https://www.braze.com/docs/developer_guide/rest_api/basics/#endpoints) ![](braze_action.png)
  3. Within Looker develop:
     1. Select the appropriate views.
     2. Add `braze_id` to the dimensions tag.
     3. ![](braze_id.png)
  4. Optional, any attributes can also be set by using a tag of `braze[]` with the name of the attribute between the `[]` ie if you want a custom attribute of `User Segment` to be sent, then the tag would be `braze[User Segment]`.
     * Note the following:
       * Attribute will only be sent if it's **included as a field within the look**.
       * Attribute name are case sensitive.
       * Supported types are: `Strings`, `Booleans`, `Numbers` and `Dates`.
       * Standard attributes can also be set as long as they matched the [standard user profiles](https://www.braze.com/docs/api/endpoints/user_data/#braze-user-profile-fields) name exactly.
       * The full tag will be within quotes, so it should look like `tags: ["braze[first_name]"]`. Other tags can also be assigned but will be ignored.
       * ![](braze_custom_tags.png)

## Usage
  1. Within a look with a `braze_id` dimension selected, click the Settings (![](looker_settings.png)) on the upper right, and select `Send...`
  2. Select the Custom Braze Action
  3. From the drop down, select the appropriate Unique User Key for the Braze account. Possible settings:
    * external_id
    * braze_id
  4. Give the export a name. If none is provided, `LOOKER_EXPORT` will be used.
  5. Advanced options: Select `Results in Table` or `All Results`
  6. Click Send.
  7. ![](braze_action_send.png)

### Braze Dashboard
If the export was correctly sent, then the user's custom attribute `looker_export` should now be set.

![](braze_custom_attributes.png)

If a tagged attribute was selected within the look, then the attribute will also be sent.
![](braze_set_custom_attribute.png)

### Braze Segments
To target the flagged users, a Braze Segments can be created that matches the flagged value.

![](braze_segments.png)

## Limitations
  * Only works with non-pivoted data.
  * Currently, the api is limited to 100,000 rows sent.
    * **Please be aware of any data point usage.**
  * Final count of user's flag maybe be lower due to duplicates or non-users.
  * Optional Attribute tags are case sensitive and will be sent as defined.
    * If standard attributes are tagged, then they must matched the standard attribute name exactly.

## Sample Outgoing API
Sample of the Outgoing API which will be sent to the [/user/track/](https://www.braze.com/docs/developer_guide/rest_api/user_data/#user-track-request) endpoint.
```
{
   "api_key" : "[API_KEY]",
   "attributes" : [
      {
        "external_id" : "user_01",
        "_update_existing_only" : true,
        "looker_export" : { "add" : ["LOOKER"] },
        "first_name" : "first name",
        "custom attribute" : "custom attribute"
      },
      {
        "external_id" : "user_02",
        "_update_existing_only" : true,
        "looker_export" : { "add" : ["LOOKER"] },
        "first_name" : "first name",
        "custom attribute" : "custom attribute"
      },
      {
        "external_id" : "user_03",
        "_update_existing_only" : true,
        "looker_export" : { "add" : ["LOOKER"] },
        "first_name" : "first name",
        "custom attribute" : "custom attribute"
      },
      .....
   ]
}
```
