import * as winston from "winston"
import * as D from "../framework"

const Slack = require("node-slack-upload")
const path = require("path")
const fs = require('fs');
// const WebClient = require('@slack/client').WebClient;
require('dotenv').config()

export class SlackFileDrop extends D.Integration {


  allowedTags = ["aws_resource_id", "aws_region"]
  constructor() {
    super()
    this.name = "slack_file_drop"
    this.label = "Slack File Drop"
    this.iconName = "slack.png"
    this.description = "Drop Files to a slack channel formatted as CSV's"
    this.supportedActionTypes = ["query", "cell"]
    this.requiredFields = []
    this.params = [
      {
        name: "token",
        label: "Slack API Token",
        required: true,
        description: "Personal API Token",
        sensitive: true,
      },
      {
        name: "webhook",
        label: "Slack Webhook",
        required: true,
        sensitive: true,
        description: "Webhook for your slack channel",
      },
    ]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.requiredFields = [{any_tag: this.allowedTags}]
  }

  async action(request: D.DataActionRequest) {

    return new Promise <D.DataActionResponse>((resolve, reject) => {

      if(!request.attachment){
        reject("Missing Attachment File")
      }

      if(!request.params.token || request.params.webHook){
        reject("Missing parameters")
      }



      const slack = new Slack(request.params.token)


      /********************************************************
       *  When running this integration (and the Azure one)
       *  the method that creates the file (fs.writeFile)
       *  needs to be run and then commented out for the
       *  second one to run properly (slack.uploadFile)
       *  I think this is a synchronicity problem --> need to
       *  check with Eric should execute the top method and then()
       *  execute the second one --> this might also have to
       *  do with the fact that the first method includes
       *  resolve and reject? should be resolved upon completion
       *  of the second method 
       *
       *  Also ... this is returning type Json should be type CSV
       *  run this integration on the server first and see what format
       *  of attachment is automatically included by Looker
       ************************************************************/


      // const attached_file = "attached_file.txt"
      // const qr = JSON.stringify(request.attachment)
      // fs.writeFile(attached_file, qr, function(err: any){
      //   if(!err){
      //     resolve()
      //     winston.info("Failure")
      //   }
      //   reject()
      //   winston.info("Success")
      // })

      slack.uploadFile({
        file: fs.createReadStream(path.join("./", "attached_file.txt")),
        filetype: 'text',
        title: 'looker_attached_file',
        initialComment: 'it worked !! ',
        channels: '#integrations_channel'
      }, function(err:any , data:any){
        if(!err){
          winston.info('Uploaded file details: ', data)
          fs.unlinkSync('./attached_file.txt')
          resolve(data)
        }
        winston.info("It failed", err)
        reject(err)
      })
    })
  }

}

D.addIntegration(new SlackFileDrop())
