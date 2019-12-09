# Google Cloud Storage
## Write data files to Google Cloud Storage bucket.

The Google Cloud Storage action enables you to send and store a data file on Google Cloud Storage via the Google Cloud API.

The action requires a Google Cloud Storage account, a programmatic service account and authorized key file to authenticate the Google Cloud API.

1. Enable the Google Cloud Storage API in the Google Cloud [console](https://console.cloud.google.com/apis/dashboard).

2. Create a Service Account in the Google Cloud [console](https://console.cloud.google.com/iam-admin/serviceaccounts/project).

![](Create&#32;GCS&#32;Service&#32;Account&#32;Key&#32;File.png)

3. Create a Service Account Key and download the JSON key file in the [console](https://console.cloud.google.com/apis/credentials). Note the Project Id, Client Email, Private Key to add in the Looker admin page to authenticate with the GCS API.

![](Create&#32;GCS&#32;Service&#32;Account.png)

4. Enable Google Cloud Storage in your looker Administration page for actions (/admin/actions).

# Google Drive
## Write files to a Google Drive folder.

The Google Drive action enables your users to connect their Google Drive to Looker using oauth, and store files in their Google Drive folders.

The action requires a Google Cloud app with the Google Drive API enabled and linked to an oauth credential.

1. Enable the Google Drive API in the Google Cloud [console](https://console.cloud.google.com/apis/dashboard).

2. Create an oauth credential using the credential wizard [console](https://console.cloud.google.com/apis/credentials/wizard/). For Step 1, specify that you are calling the `Google Drive API` from a `Web Server (e.g. node.js, Tomcat`, and will access `User data`. For Step 2, give your credential a name, and specify an Authorized Callback URI like `https://[BASE_URI]/actions/google_drive/oauth_redirect`.

3. Setup the consent screen for your oauth credential [console](https://console.cloud.google.com/apis/credentials/consent). You must enable the Google Drive scope `https://www.googleapis.com/auth/drive`, and specify the action hub's domain name as an authorized domain. Because the Google Drive scope interacts with sensitive customer information, you must complete the other fields on the consent screen configuration, and request approval by Google before it will be trusted.

4. Set the oauth client ID to an environment variable for your Action Hub called `GOOGLE_DRIVE_CLIENT_ID`. Assign the oauth client secret to `GOOGLE_DRIVE_CLIENT_SECRET`.

5. You must set an environment variable called `CIPHER_MASTER` to facilitate the oauth workflow.

6. Enable Google Drive in your looker Administration page for actions (/admin/actions).
