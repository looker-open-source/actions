import * as D from "../framework"

const client = require("ssh2-sftp-client")
const path = require("path")
const { URL } = require("url")

export class SFTPIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "sftp"
    this.label = "SFTP"
    this.iconName = "sftp.png"
    this.description = "Send files to an SFTP server."
    this.supportedActionTypes = ["query"]
  }

  let stream = sftp.createWriteStream(remotePath, {encoding: "utf-8", useCompression: undefined});
            let data;

            stream.on('error', reject);
            stream.on('close', resolve);

            if (input instanceof Buffer) {
                data = stream.end(input);
                return false;
            }
            data = input.pipe(stream);

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        reject("Couldn't get data from attachment.")
        return
      }

      if (!request.formParams || !request.formParams.address) {
        reject("Needs a valid SFTP address.")
        return
      }

      const sftp = this.sftpClientFromRequest(request)

      const data = request.attachment.dataBuffer
      const url = new URL(request.formParams.address)

      if (!url.pathname) {
        reject("Needs a valid SFTP address.")
        return
      }

      const remotePath = path.join(url.pathname, request.suggestedFilename())

      sftp.connect({
        host: url.hostname,
        username: request.formParams.username,
        password: request.formParams.password,
      }).then(() => {
        return sftp.put(data, remotePath)
      }).then(() => resolve(new D.DataActionResponse()))
        .catch((err: any) => reject(err))
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
      sensitive: true,
    }]
    return form
  }

  private sftpClientFromRequest(request: D.DataActionRequest) {
    const url = new URL(request.formParams.address)
    return new client()
  }

}

D.addIntegration(new SFTPIntegration())
