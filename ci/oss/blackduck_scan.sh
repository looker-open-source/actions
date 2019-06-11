#!/bin/bash

echo "Starting blackduck scan"

#yarn -v
#rvm @global do gem uninstall bundler --all --no-executables

# setup nvm for this run
#echo "Setting up nvm"
#. ~/.nvm/nvm.sh
#nvm install
#echo "Setting up nvm complete"

#echo "ALL SETUP COMPLETE, RUNNING BLACKDUCK ON VERSION $BRANCH_TO_SCAN"

bash <(curl -s https://detect.synopsys.com/detect.sh) --blackduck.url="https://looker.blackducksoftware.com" --blackduck.api.token=$BLACKDUCK_TOKEN --blackduck.trust.cert=true --detect.yarn.path=$WORKSPACE/.yarn/bin/yarn --detect.project.version.name=$BRANCH_TO_SCAN --detect.project.name=actionhub --detect.risk.report.pdf=true --detect.risk.report.pdf.path=./ --detect.notices.report=true --detect.notices.report.path=./ --detect.report.timeout=3600 --blackduck.timeout=3600 --detect.policy.check.fail.on.severities=BLOCKER

