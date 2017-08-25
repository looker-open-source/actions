// import * as uuid from "uuid"

import * as D from "../framework"
import * as winston from 'winston'

import * as EC2 from 'aws-sdk/clients/ec2'
// import * as Promise from 'bluebird'


export class AwsEc2TerminateIntegration extends D.Integration {

  allowedTags = ["aws_resource_id", "aws_region"]

  constructor() {
    super()

    this.name = "aws_ec2_terminate_event"
    this.label = "AWS EC2 Terminate"
    this.iconName = "AWS_EC2.png"
    this.description = "Terminate an EC2 Instance."
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
          sensitive: true,
      },
    ]
    this.supportedActionTypes = ["query"]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.supportedVisualizationFormattings = ["noapply"]
    this.requiredFields = [{any_tag: this.allowedTags}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

winston.info(JSON.stringify(request.attachment))
      if (!(request.attachment && request.attachment.dataJSON)) {
        reject("No attached json")
        return
      }

      const qr = request.attachment.dataJSON
      if (!qr.fields || !qr.data) {
        reject("Request payload is an invalid format.")
        return
      }

      const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))

      const regionFields = fields.filter((f: any) =>
        f.tags && f.tags.some((t: string) => t === "aws_region"),
      )
      if(regionFields.length != 1){
          reject("EC2 Terminate integration requires exactly one fields tagged with 'aws_region'")
      }

      const resourceIdFields = fields.filter((f: any) =>
        f.tags && f.tags.some((t: string) => t === "aws_resource_id"),
      )
      if(resourceIdFields.length < 1){
          reject("EC2 Terminate integration requires at least one field tagged with 'aws_resource_id'")
      }

      const regionField = regionFields[0]

      // TODO: it would be nice to use all of the columns containing resouceIds, instead of just the first one
      const resourceIdField = resourceIdFields[0]

      const regionToInstanceIds: any = {}

      for (const row of qr.data) {
        const traits: any = {}
        for (const field of fields) {
          const value = row[field.name].value
          if (resourceIdField && field.name === resourceIdField.name) {
            traits.awsResourceId = value
          }
          if (regionField && field.name === regionField.name) {
            traits.awsRegion = value
          }
        }

        if(traits.awsRegion){
            if( ! (regionToInstanceIds[traits.awsRegion])){
                regionToInstanceIds[traits.awsRegion] = [traits.awsResourceId]
            } else {
                regionToInstanceIds[traits.awsRegion].push(traits.awsResourceId)
            }
        }
      }

      const ec2Promises = [] as PromiseLike<number>[]
      for( const region in regionToInstanceIds) {
        const ec2 = new EC2({
            region: region,
            accessKeyId: request.params.aws_access_key,
            secretAccessKey: request.params.aws_secret_key
        });
        ec2Promises.push(
          ec2.describeInstances({
              Filters: [
                  {
                      Name: "instance-id",
                      Values: regionToInstanceIds[region]
                  }
              ]
          }).promise().then(function(ec2Response){
              let killedCount = 0
              if( ! ec2Response.Reservations){
                  throw "ec2 returned a bad response with no 'Reservations' property"
              }
              ec2Response.Reservations.forEach(function(reservation){
                  if(! reservation.Instances){
                      throw "ec2 returned a bad response with no 'Instances' property"
                  }
                  reservation.Instances.forEach(function(instance){
                      winston.info("here I will kill instance ",instance.InstanceId," in region ", region)
                      killedCount += 1
                  })
              })
              return killedCount
          })
        )
      }

      Promise.all(ec2Promises).then(function(killedCounts){
          let totalKilledCount = 0
          for (const killedCount of killedCounts) {
              totalKilledCount += killedCount
          }
          winston.info(JSON.stringify(totalKilledCount))
          resolve(new D.DataActionResponse())
      }, reject)


      // TODO: does this batching have global state that could be a security problem
    //   const err = null;
    //   if (err) {
    //     reject(err)
    //   } else {
    //     resolve(new D.DataActionResponse())
    //   }
      })

    }


}

D.addIntegration(new AwsEc2TerminateIntegration())
