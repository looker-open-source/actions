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
