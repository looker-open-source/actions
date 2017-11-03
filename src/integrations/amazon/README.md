# AWS S3, EC2

1. Existing User
1. New Programmatic Useratic

# Existing User
If you have an existing user with programmatic full access to EC2 or S3, go to AWS IAM [user console](
https://console.aws.amazon.com/iam/home?#/users) to create credentials.

![](AWS Select User.png)

Select Security credentials

![](AWS Create Access Key.png)

Select Create access key

![](AWS Copy Credentials.png)


Copy Access key ID and Secret access key

# New Programmatic User
Go to AWS IAM [user console](
https://console.aws.amazon.com/iam/home?#/users) to create a new programmatic user. Select Add User

![](AWS Create User Programmatic Access.png)

Name the user and select Programmatic Access type. Select Next: permissions.

Select AmazonS3FullAccess or AmazonEC2FullAccess depending on integration.
![](AWS S3 Full Access.png)
![](AWS EC2 Full Access.png)

Select Create user
![](AWS S3 Full Access Create User.png)

Copy Access key ID and Secret access key
![](AWS S3 Full Access Credentials.png)



