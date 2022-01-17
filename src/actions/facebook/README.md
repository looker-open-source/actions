# Facebook Custom Audiences

## Send data to Facebook Custom Audiences

The Facebook Custom Audiences Action enables you to create audiences based on your first-party data and send them to Facebook Ads Custom Audiences. You authenticate with your Facebook account and then you're able to send one-off or recurring uploads to Facebook Ads.

## Enable the action

A Looker admin must enable this action by following these steps:

1. Navigate to the [**Actions** page](https://docs.looker.com/admin-options/platform/actions) from the Looker **Admin** panel.
2. Next to the **Facebook Custom Audiences** action, click **Enable**. Click the **Refresh** button if the actions do not appear in the list.
3. Switch on the **Enable** toggle and click **Save**.

Once enabled, this action will show up as a destination option for data deliveries in the Scheduler.

## Configuring your Looker report

Before you can use the Facebook Custom Audiences action, you must ensure that the column [labels](https://docs.looker.com/reference/field-params/label-for-field) in your Looker report map correctly to the [user identifiers](https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences/#hash) in Facebook Ads.

There are two ways to match your report data to the correct identifers:

### Option 1: Match using LookML field tags

By default Facebook Custom Audiences will first try to match your fields by [tags](https://docs.looker.com/reference/field-params/tags). These tags are case insensitive:

```
email
phone
birth_year
birth_month
birth_day
last_name
first_name
first_initial
city
state
zip
country
mad_id
external_id
```

### Option 2: Match using regex

Any report fields which don't match on tags will fall back to a regex match using the pattern below. Any fields which fail to match a regex pattern will be omitted from the upload to Facebook Ads.

```
[/email/i, "EMAIL"],
[/phone/i, "PHONE"],
[/year/i, "DOBY"],
[/month/i, "DOBM"]
[/day/i, "DOBD"],
[/last/i, "LN"],
[/first/i, "FN"],
[/initial/i, "FI"],
[/city/i, "CT"],
[/state/i, "ST"],
[/postal|zip/i, "ZIP"]
[/country/i, "COUNTRY"],
[/madid/i, "MADID"],
[/external/i, "EXTERN_ID"]

```

Although each column label maps to only one identifier, there can be
multiple column labels that map to the same identifier. For example, in a
report containing just `work_email` and `home_email`, both will be mapped to the email identifier.

If your column labels do not match any identifiers, a Looker developer can:

- Update the column's [label](https://docs.looker.com/reference/field-params/label-for-field) in the report's LookML to match on regex, or,
- Update the LookML to match on LookML field tags

## Preparing your data to send to Facebook Ads

Facebook Ads expects your data in a specific format, otherwise matches may fail. While it's normal for some matches to fail, you can maximize your audience matching by making sure your data is in the correct format.

Facebook specifies the exact formats for each field [here](https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences#hash).

By default the integration will try to format phone numbers, names, and dates. It will also attempt to lookup state and country codes for you. If your data is an unusual format this automatic formatting may fail.

_Note: If you have already hashed your data, the integration cannot do any formatting for you. Unless you know your data is already hashed, this limitation won't affect you._

# Sending data to Facebook Custom Audiences

You can send data from Explores and Looks to the Facebook Custom Audiences action destination from the Looker Scheduler.

> Make sure that your Facebook Ads account meets the minimum criteria before using this Looker integration. You can read about the general setup for custom audiences [here](https://developers.facebook.com/docs/marketing-api/audiences/reference/custom-audience-terms-of-service).

From your selected Explore or Look, click the gear menu in the upper right corner. For Looks or Explores, select **Send** for one-time deliveries. For Looks, select **Schedule** for recurring deliveries. For Explores, because there is no option to send a recurring delivery, you must select **Save & Schedule** to first save the Explore as a Look and then schedule the Look for a recurring delivery.

> For more information about scheduling data deliveries, see the [Using the Looker Scheduler to deliver content](https://docs.looker.com/sharing-and-publishing/scheduling-and-sharing/scheduling) documentation page.

Selecting a delivery option opens the Scheduler for Explores and Looks. Enter a title for your delivery. To deliver to the Facebook Custom Audiences destination:

1.  Select the **Facebook Custom Audiences** icon from the **Where should this data go?** section of the Scheduler.
2.  The first time you deliver to this destination, you must authenticate with your Facebook OAuth credentials. In the **Facebook Custom Audiences** section of the Scheduler, click the **Sign in with Facebook** button.
3.  In the **Sign in with Facebook OAuth** screen, select your business Facebook account. Check the box next to the permissions you would like to grant the Looker app. Click **Continue** to
    confirm your choice to grant the requested permissions. If your login is successful, you will see a message to close the browser tab and return to the Scheduler.
4.  Back in the **Facebook Custom Audiences** section of the Scheduler, click the **Verify credentials** button.
5.  Select your business account from the **Choose a business** drop-down. This is the account that your ads account falls under. Typically a business account and not your personal Facebook account.
6.  Select your ads account from the **Choose a Facebook ad account** drop-down.
7.  Choose whether to create a new audience, append to an existing audience, or replace an existing audience. Creating a new audience or updating resets your ads to the "learning" stage. Replacing does not.

    > Replacing will first delete all users from the selected audience and _then_ add new users.

    1. If you select **Update existing audience** or **Replace existing audience**, pick which audience you want to append to from the following drop-down.
    2. If you select **Create new audience**, enter values for the name and description.

8.  Determine if you want the data to be hashed prior to delivery. All
    personal data must be normalized and hashed before uploading to Facebook
    Ads. If your data is not yet hashed, select **Yes** and Looker will attempt to hash the data according to Facebook Ads requirements. If you select **No**, then the data will be sent as it appears in Looker, which means that the data should already be normalized and hashed within your database.

    > If the data is not hashed correctly, your customer list will not match any audiences in Facebook Ads.

9.  For recurring deliveries, set the trigger for the delivery. For **Repeating interval** triggers, set the frequency with which you would like to deliver this data. For **Datagroup update** triggers, choose the triggering datagroup from the **Select Datagroup** drop-down. Apply any additional filters to the scheduled delivery in the **Filters** section of the Scheduler.
10. Expand the **Advanced options** menu in the Scheduler. *Make sure to select **All Results***. For recurring deliveries, select any additional scheduling conditions you would like to place on the delivery.
11. Review your delivery settings. For one-time deliveries, click **Send**. For recurring deliveries, click **Save All**.

# Troubleshooting

- If your Facebook Ads account has never run an ad, Facebook may require you to run ads without incident for two weeks before using this feature.
- Look for account errors or restrictions in your Facebook business [Ads Manager dashboard](https://business.facebook.com/adsmanager).
- If matches are failing through the integration, attempt a manual upload to a custom audience from customer list using the [Facebook audience tools](https://www.facebook.com/adsmanager/audiences) to get detailed feedback on why matches aren't working.
