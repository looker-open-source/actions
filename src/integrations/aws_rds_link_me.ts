// import * as uuid from "uuid"

import * as D from "../framework"
import * as winston from 'winston'

// import * as EC2 from 'aws-sdk/clients/ec2'
// import * as Promise from 'bluebird'

import * as nodemailer from 'nodemailer'


export class AwsRdsLinkMeEvent extends D.Integration {

  allowedTags = ["aws_resource_id"]

  allRegions = ["us-west-1", "us-west-2", "us-east-1", "us-east-2"]

  constructor() {
    super()

    this.name = "aws_rds_link_me_event"
    this.label = "Get a link to AWS Console from RDS Resouce in Cell"
    this.iconName = "AWS_EC2.png"
    this.description = ""
    this.params = [
      {
        description: "",
        label: "Email Link To",
        name: "email",
        required: true,
        sensitive: false,
      }
    ]
    this.supportedActionTypes = ["cell"]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.supportedVisualizationFormattings = ["noapply"]
    this.requiredFields = [{any_tag: this.allowedTags}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve , reject ) => {


      /*
      example request:

      {
        "type": "cell",
        "scheduled_plan": null,
        "form_params": {},
        "data": {
          "value": "arn:aws:rds:ap-northeast-1:718158619460:db:test",
            "email": "joe.rozo@productops.com"
        },
        "attachment": null
      }

      After DataActionRequest.fromRequest():

      {
        "formParams": {},
        "params": {
          "value": "arn:aws:rds:ap-northeast-1:718158619460:db:test"
            "email": "joe.rozo@productops.com"
            "aws_access_key": "",
            "aws_secret_key": ""
        },
        "type": "cell",
        "instanceId": "33affe795e918360fb44f4c1dd0adf6c",
        "webhookId": "2a958224efa273086a8cf3b338caa0c8"
      }

      */
      if( ! request.params ){
          reject("incorrect DataActionRequest: no 'params' property")
      }

      if( ! request.params.value || request.params.value.length < 1){
          reject("incorrect DataActionRequest: property 'params.value' is empty")
      }
        if( ! request.params.value || request.params.email.length < 1){
            reject("incorrect DataActionRequest: property 'params.email' is empty")
        }
      const rdsMatcher = /^arn:aws:rds:([^:]*):[^:]*:db:(.*)/.exec(request.params.value)
      if( rdsMatcher ){
          const resp = new D.DataActionResponse()
          resp.message = `https://${rdsMatcher[1]}.console.aws.amazon.com/rds/home?region=${rdsMatcher[1]}#dbinstances:id=${rdsMatcher[2]}`

          AwsRdsLinkMeEvent.mail(request.params.email, resp.message, (err: any)=>{
            //   winston.info("erro?")
            //   winston.info(JSON.stringify(err))
              if(err){
                  reject(err)
              } else {
                  resolve(resp)
              }
          })
      } else {
          resolve(new D.DataActionResponse())
      }

    })

  }

  static mail(to: string, link: string, callback: any) {

    let transporter = nodemailer.createTransport({
        host: 'email-smtp.us-west-2.amazonaws.com',
        port: 465,
        secure: true, // secure:true for port 465, secure:false for port 587
        auth: {
            user: 'AKIAIFLSO4LZC7SFYHAQ',
            pass: 'AskgLNtBWYIcMZG8a1fzbZJHspKlmZrVEv24ZsJ7kv0w'
        }
    });
    let mailOptions = {
        from: 'eric.fultz@productops.com', // sender address
        to: to, // list of receivers
        subject: 'Looker AWS Integration - Link Me', // Subject line
        text: `Here's your link:\n${link}`, // plain text body
        html: `Here's your link:<br><a href="${link}">${link}</a>` // html body
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            // winston.error(JSON.stringify(error));
            callback(error)
        } else {
            winston.info('Message %s sent: %s', info.messageId, info.response);
            callback()
        }
    });
  }

}

D.addIntegration(new AwsRdsLinkMeEvent())
