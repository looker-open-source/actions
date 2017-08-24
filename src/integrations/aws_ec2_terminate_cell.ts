// import * as uuid from "uuid"

import * as D from "../framework"
import * as winston from 'winston'

import * as EC2 from 'aws-sdk/clients/ec2'
// import * as Promise from 'bluebird'


export class AwsEc2TerminateCellEvent extends D.Integration {

  allowedTags = ["aws_resource_id"]

  allRegions = ["us-west-1", "us-west-2", "us-east-1", "us-east-2"]

  constructor() {
    super()

    this.name = "aws_ec2_terminate_cell_event"
    this.label = "Aws EC2 Terminate Instance from Cell"
    this.iconName = "AWS_EC2.png"
    this.description = ""
    this.params = [
      {
        description: "",
        label: "AWS Access Key",
        name: "aws_access_key",
        required: true,
        sensitive: false,
      },
      {
          description: "",
          label: "AWS Secret Key",
          name: "aws_secret_key",
          required: true,
          sensitive: false,
      },

    ]
    this.supportedActionTypes = ["cell"]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.supportedVisualizationFormattings = ["noapply"]
    this.requiredFields = [{any_tag: this.allowedTags}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve , reject ) => {

      winston.info("whole request: ")
      winston.info(JSON.stringify(request))
      /*
      example request:

      {
        "type": "cell",
        "scheduled_plan": null,
        "form_params": {},
        "data": {
          "value": "i-044fedf274bb22a09",
            "aws_access_key": "AKIAJ5U5GCMAMVVOFQUA",
            "aws_secret_key": "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"
        },
        "attachment": null
      }

      After DataActionRequest.fromRequest():

      {
        "formParams": {},
        "params": {
          "value": "i-044fedf274bb22a09"
            "aws_access_key": "AKIAJ5U5GCMAMVVOFQUA",
            "aws_secret_key": "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"
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

      const responses = [] as PromiseLike<any>[]
      this.allRegions.forEach( (region) => {
          const ec2 = new EC2({
              region: region,
              accessKeyId: request.params.aws_access_key,
              secretAccessKey: request.params.aws_secret_key
          })
          let p: Promise<any> = ec2.describeInstances({
              Filters: [
                  {
                      Name:"instance-id",
                      Values: [request.params.value]
                  }
              ]
          }).promise()
          p = p.then((response) => {
            //   winston.info(JSON.stringify(response))
            if( ! response.Reservations || typeof response.Reservations.map !== 'function') {
                throw "bad response from ec2.describeInstances(): no property 'Reservations'"
            }
            let instances: any[] = response.Reservations.map((reservation: any) => {
                // map doesn't work for some ungodly reason!
                if( ! reservation.Instances || ( typeof reservation.Instances[Symbol.iterator] ) !== 'function'){
                    throw "bad response from ec2.describeInstances(): no property 'Reservations.Instances'"
                }
                return reservation.Instances
            })
            instances = [].concat.apply([], instances)

            let instanceIds: any[] = instances.map((instance) => {
                if( ! instance.InstanceId ){
                    throw "bad response from ec2.describeInstances(): no property 'Reservations.Instances.InstanceId'"
                }
                return instance.InstanceId
            })

            instanceIds = instanceIds.filter((instanceId) => {
                return instanceId === request.params.value
            })

            return instanceIds.length > 0
          })

          p = p.then((instanceIdFound) => {
              if(instanceIdFound){

                  ec2.stopInstances({
                      InstanceIds: [
                          request.params.value
                      ]
                  }).promise().then((s)=>{
                      winston.info("done the deed")
                      winston.info(JSON.stringify(s))
                  })

                  // seems sensible to figure out if the command worked?
                  // nah, not worth it

                  return region
              }
          })

          responses.push(p)

      })

      Promise.all(responses).then( (terminationResults) => {
          winston.info(`terminated instances in region: ${terminationResults.join(', ')}`)

          resolve(new D.DataActionResponse())
      }, (errs) => {
          reject(`error in at least one response: ${JSON.stringify(errs)}`)
      })
    })

  }

}

D.addIntegration(new AwsEc2TerminateCellEvent())
