import * as Hub from "../../hub"

import * as Path from "path"
const Client: any = require('promise-ftp');
import * as URL from "url"

export class FTPAction extends Hub.Action {

  name = "ftp"
  label = "FTP"
  iconName = "ftp/ftp.png"
  description = "Send data files to an FTP server."
  supportedActionTypes = [Hub.ActionType.Query]
  params = []

  async execute(request: Hub.ActionRequest) {

    if (!request.attachment || !request.attachment.dataBuffer) {
      throw new Error("Couldn't get data from attachment.")
    }

    if (!request.formParams.address) {
      throw new Error("Needs a valid FTP address.")
    }

    const client = await this.ftpClientFromRequest(request)
    const parsedUrl = URL.parse(request.formParams.address)

    if (!parsedUrl.pathname) {
      throw "Needs a valid FTP address."
    }

    const data = request.attachment.dataBuffer
    const fileName = request.formParams.filename || request.suggestedFilename() as string
    const remotePath = Path.join(parsedUrl.pathname, fileName)

    try {
      await client.put(data, remotePath);
    }
    catch (err) {
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
    finally {
      await client.end();
    }
    
    return new Hub.ActionResponse({ success: true })
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      name: "address",
      label: "Address",
      description: "e.g. ftp://host/path/",
      type: "string",
      required: true,
    }, {
      name: "username",
      label: "Username",
      type: "string",
      required: true,
    }, {
      name: "password",
      label: "Password",
      type: "string",
      required: true,
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]
    return form
  }

  private async ftpClientFromRequest(request: Hub.ActionRequest) {
    const client = new Client()
    const parsedUrl = URL.parse(request.formParams.address!)

    if (!parsedUrl.hostname) {
      throw new Error("Needs a valid FTP address.")
    }

    try {
      await client.connect({
        host: parsedUrl.hostname,
        user: request.formParams.username,
        password: request.formParams.password,
        port: +(parsedUrl.port ? parsedUrl.port : 21),
      })
    } catch (e) {
      throw e
    }

    return client
  }

}

Hub.addAction(new FTPAction())