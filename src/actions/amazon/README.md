# AWS S3, EC2
## Write data files to an S3 bucket or Stop an EC2 instance.

The Amazon S3 actions enables you to send and store a data file on S3 via the Amazon S3 API. The Amazon EC2 Stop Instance action allows you to stop an EC2 (from a dimension tagged with `aws_resource_id` in LookML) via the Amazon EC2 API.

1. Existing User
1. New Programmatic User

# Existing User
If you have an existing user with programmatic full access to EC2 or S3, go to AWS IAM [user console](
https://console.aws.amazon.com/iam/home?#/users) to create credentials.

![](AWS&#32;Select&#32;User.png)

Select Security credentials

![](AWS&#32;Create&#32;Access&#32;Key.png)

Select Create access key

![](AWS&#32;Copy&#32;Credentials.png)

Copy Access key ID and Secret access key

# New Programmatic User
Go to AWS IAM [user console](
https://console.aws.amazon.com/iam/home?#/users) to create a new programmatic user. Select Add User

![](AWS&#32;Create&#32;User&#32;Programmatic&#32;Access.png)

Name the user and select Programmatic Access type. Select Next: permissions.

Select AmazonS3FullAccess or AmazonEC2FullAccess depending on action.
![](AWS&#32;S3&#32;Full&#32;Access.png)
![](AWS&#32;EC2&#32;Full&#32;Access.png)

Select Create user
![](AWS&#32;S3&#32;Full&#32;Access&#32;Create&#32;User.png)

Copy Access key ID and Secret access key
![](AWS&#32;S3&#32;Full&#32;Access&#32;Credentials.png)

# Enable Amazon S3 or Amazon EC2 in your looker Administration page for actions (/admin/actions).
