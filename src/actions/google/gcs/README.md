# Google Cloud Storage

**This is not an officially supported Google product.**

## Write data files to Google Cloud Storage bucket.

The Google Cloud Storage action enables you to send and store a data file on Google Cloud Storage via the Google Cloud API.

The action requires a Google Cloud Storage account, a programmatic service account and authorized key file to authenticate the Google Cloud API.

1. Enable the Google Cloud Storage API in the Google Cloud [console](https://console.cloud.google.com/apis/dashboard).

2. Create a Service Account in the Google Cloud [console](https://console.cloud.google.com/iam-admin/serviceaccounts/project).

![](Create&#32;GCS&#32;Service&#32;Account&#32;Key&#32;File.png)

3. Create a Service Account Key and download the JSON key file in the [console](https://console.cloud.google.com/apis/credentials). Note the Project Id, Client Email, Private Key to add in the Looker admin page to authenticate with the GCS API.

![](Create&#32;GCS&#32;Service&#32;Account.png)

4. Enable Google Cloud Storage in your looker Administration page for actions (/admin/actions).

## Filename date tokens

The **Filename** field supports UTC date/time tokens, which are substituted at delivery time. Each
token is replaced independently wherever it appears, so you can compose any format using your own
separators (`-`, `_`, `/`, etc.). Tokens are evaluated for the example moment `2026-06-17 08:30:45`
UTC below:

| Token        | Meaning                            | Example    |
| ------------ | ---------------------------------- | ---------- |
| `{YYYYMMDD}` | 4-digit year + 2-digit month/day   | `20260617` |
| `{YYYY}`     | 4-digit year                       | `2026`     |
| `{YY}`       | 2-digit year                       | `26`       |
| `{MM}`       | 2-digit month (zero-padded)        | `06`       |
| `{DD}`       | 2-digit day of month (zero-padded) | `17`       |
| `{HH}`       | 2-digit hour, 24-hour (zero-padded)| `08`       |
| `{mm}`       | 2-digit minutes (zero-padded)      | `30`       |
| `{ss}`       | 2-digit seconds (zero-padded)      | `45`       |

> **Note:** tokens are **case-sensitive**. `{MM}` is the **month** and `{mm}` is **minutes**
> (the moment.js convention). `{YYYYMMDD}` is simply a convenience for `{YYYY}{MM}{DD}`.

GCS object names may contain `/`, so tokens can be used to date-partition deliveries into "folders":

```
report_{YYYYMMDD}.csv                 ->  report_20260617.csv
{YYYY}-{MM}-{DD}.csv                  ->  2026-06-17.csv
daily/report_{YYYYMMDD}.csv           ->  gs://<bucket>/daily/report_20260617.csv
daily/{YYYY}/{MM}/report.csv          ->  gs://<bucket>/daily/2026/06/report.csv
hourly/{YYYYMMDD}T{HH}{mm}{ss}.csv    ->  gs://<bucket>/hourly/20260617T083045.csv
```

Filenames with no tokens are written unchanged. When **Overwrite** is set to "No", a uniqueness
timestamp is still appended after token substitution.

**Note on time zone:** tokens are resolved using the action hub server's UTC clock, not the timezone
of the query or schedule. The action only receives the rendered data file, not the query's filters or
timezone, so server-side UTC is used for deterministic, predictable partitioning.

## Writing to a bucket in another project

By default the **Bucket** dropdown lists buckets visible to the service account in its configured
project, which requires the project-level `storage.buckets.list` permission. To deliver to a bucket
in a different project (for example, a partner's bucket) you usually only have object-level access on
that single bucket and cannot list the project's buckets.

For this case, leave the **Bucket** dropdown blank and enter the exact bucket name in the
**Bucket name (manual override)** field. The manual override takes precedence over the dropdown, and
delivery only requires `storage.objects.create` (e.g. the `roles/storage.objectCreator` role) on the
target bucket — no project-level listing permission is needed.
