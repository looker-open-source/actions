import * as Hub from "../../../hub";
import * as jsforce from "jsforce";

export class SalesforceLoginHelper {
  // login with (username, password + security_token) for now
  async salesforceLogin(request: Hub.ActionRequest) {
    const sfdcConn = new jsforce.Connection({
      loginUrl: request.params.salesforce_domain!,
    });

    await sfdcConn
      .login(
        request.params.salesforce_username!,
        request.params.salesforce_password! +
          request.params.salesforce_security_token!
      )
      .catch((e) => {
        throw e;
      });

    return sfdcConn;
  }
}
