import * as D from "../../framework"

import * as Path from "path"
import * as Client from "ssh2-sftp-client"
import * as URL from "url"

export class SFTPIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "sftp"
    this.label = "SFTP"
    this.iconName = "sftp/sftp.png"
    this.description = "Send data files to an SFTP server."
    this.supportedActionTypes = ["query"]
    this.params = []
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>(async (resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        reject("Couldn't get data from attachment.")
        return
      }

      if (!request.formParams || !request.formParams.address) {
        reject("Needs a valid SFTP address.")
        return
      }

      const client = await this.sftpClientFromRequest(request)
      const parsedUrl = URL.parse(request.formParams.address!)
      if (!parsedUrl.pathname) {
        throw "Needs a valid SFTP address."
      }
      const data = request.attachment.dataBuffer
      const fileName = request.formParams.filename || request.suggestedFilename() as string
      const remotePath = Path.join(parsedUrl.pathname, fileName)

      client.put(data, remotePath)
        .then(() => resolve(new D.DataActionResponse()))
        .catch((err: any) => resolve(new D.DataActionResponse({success: false, message: err.message})))
    })
  }

  async form() {
    const form = new D.DataActionForm()
    form.fields = [{
      name: "address",
      label: "Address",
      description: "e.g. sftp://host/path/",
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

  private async sftpClientFromRequest(request: D.DataActionRequest) {

    const client = new Client()
    const parsedUrl = URL.parse(request.formParams.address!)
    if (!parsedUrl.hostname) {
      throw "Needs a valid SFTP address."
    }
    try {
      await client.connect({
        host: parsedUrl.hostname,
        username: request.formParams.username,
        password: request.formParams.password,
        port: +(parsedUrl.port || 22),
      })
    } catch (e) {
      throw e
    }
    return client
  }

}
