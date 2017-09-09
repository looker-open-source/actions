import * as D from "../framework"

const Slack = require("node-slack-upload")
const path = require("path")
const fs = require("fs")
// const WebClient = require('@slack/client').WebClient;
require("dotenv").config()

export class SlackFileDrop extends D.Integration {

  constructor() {
    super()
    this.name = "slack_file_drop"
    this.label = "Slack File Drop"
    this.iconName = "slack.png"
    this.description = "Drop Files to a slack channel formatted as CSV's"
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
    this.params = [
      {
        name: "token",
        label: "Slack API Token",
        required: true,
        description: "https://api.slack.com/custom-integrations/legacy-tokens",
        sensitive: true,
      }
    ]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
  }

  async action(request: D.DataActionRequest) {

    return new Promise <D.DataActionResponse>((resolve, reject) => {

      if (!request.attachment){
        reject("Missing Attachment File")
      }

      if (!request.params.token || !request.formParams.channel || ! request.formParams.filename){
        reject("Missing parameters")
      }

      const slack = new Slack(request.params.token)

      /********************************************************
       *   this is returning type Json should be type CSV
       *  run this integration on the server first and see what format
       *  of attachment is automatically included by Looker
       ************************************************************/

      let file_upload = function(){
        slack.uploadFile({
          file: fs.createReadStream(path.join("./", request.formParams.filename)),
          filetype: "text",
          title: request.formParams.filename,
          initialComment: "File added by Looker",
          channels: request.formParams.channel,
        }, function(err: any , data: any){
          if (!err){
            fs.unlinkSync("./"+request.formParams.filename)
            resolve(new D.DataActionResponse())
          }
          reject(err)
        })
      }

      const attached_file = request.formParams.filename
      const qr = JSON.stringify(request.attachment)
      fs.writeFile(attached_file, qr, function(err: any){
        if (!err){
          file_upload()
        }
      })
    })
  }

  async form(){
    const form = new D.DataActionForm()

    form.fields = [
      {
        name: "channel",
        label: "Slack Channel",
        required: true,
        sensitive: false,
        description: "Name of the Slack channel you would like to post to",
        type: "string",
      },
      {
        name: "filename",
        label: "Filename",
        required: true,
        sensitive: false,
        description: "",
        type: "string",
        default: "looker_data.txt",
      },
    ]

    return form
  }

}

D.addIntegration(new SlackFileDrop())
