#!/bin/bash

# Any errors, fail the script so Jenkins will fail the job and alert us to a problem
set -e

echo "Starting setup for blackduck scan"

echo "Environment is $IMAGE_ENVIRONMENT and AWS Account ID is $ACCOUNT_ID"

export ECR_IMAGE_URL=$ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/integrations:JENKINS-$PARENT_BUILD_ID-$APP_VERSION

yarn -v

# Log into AWS
ECRLOGIN=$(aws ecr get-login --region us-east-1 --no-include-email --registry-ids "$ACCOUNT_ID")

runlogin() {
    $ECRLOGIN
}

runlogin

echo "$ECR_IMAGE_URL"
docker pull "$ECR_IMAGE_URL"

echo "SHOW LIST OF IMAGES"
docker images

echo "ALL SETUP COMPLETE, RUNNING BLACKDUCK ON ACTIONHUB CONTAINER"
bash <(curl -s https://detect.synopsys.com/detect.sh) \
--blackduck.url="https://looker.blackducksoftware.com" \
--blackduck.api.token=$BLACKDUCK_TOKEN \
--detect.docker.image=$ECR_IMAGE_URL \
--detect.tools=DOCKER \
--detect.project.name=actionhub \
--logging.level.com.synopsys.integration=DEBUG \
--detect.project.version.name=$IMAGE_ENVIRONMENT-$PARENT_BUILD_ID-$APP_VERSION

echo "SCAN COMPLETE, REMOVING DOCKER IMAGES FROM NODE"
docker system prune -a -f
docker images
