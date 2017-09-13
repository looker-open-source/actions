/**
 * Created by joe on 9/13/17.
 */

import * as D from "../framework"
const AWS = require("aws-sdk")
const winston = require("winston")
AWS.config.update({region: "us-east-1"})

export class aws_ml extends D.Integration {

    constructor() {
        super()

        this.name = "aws_machine_learning"
        this.label = "Amazon Machine Learning"
        this.iconName = "amazon_s3.png"
        this.description = "Builds a machine learning model for specified data in an s3 Bucket"
        this.supportedActionTypes = ["query"]
        this.requiredFields = []
        this.params = [
            {
                name: "access_key_id",
                label: "Access Key",
                required: true,
                description: "Your aws access key",
                type: "string",
            }, {
                name: "secret_access_key",
                label: "Secret Key",
                required: true,
                sensitive: true,
                description: "Your aws secret key",
                type: "string",
            }, {
                name: "data_source_name",
                label: "Name for Your Data Source",
                required: true,
                sensitive: true,
                description: "Unique name for your aws model",
                type: "string",
               },
            {
                name: "training_id",
                label: "Unique ID For Your Training Data",
                required: true,
                sensitive: true,
                description: "Unique ID for your training Data ",
                type: "string",
            },
            {
                /* s3://looker.instances/schema5.schema */
                name: "schema_s3_path",
                label: "S3 Bucket Path to your Schema",
                required: true,
                sensitive: true,
                description: "Path to Data Schema in your s3 Bucket",
                type: "string",
            },
            {
                /* s3://looker.instances/banking3.csv */
                name: "data_s3_path",
                label: "S3 Bucket Path to Your Data",
                required: true,
                sensitive: true,
                description: "Path to CSV Data in your s3 Bucket",
                type: "string",
            },
        ]
    }

    async action(request: D.DataActionRequest) {
        return new Promise<D.DataActionResponse>((resolve, reject) => {

            if (!request.attachment || !request.attachment.dataBuffer) {
                throw "Couldn't get data from attachment"
            }

            if (!request.formParams ||
                !request.formParams.bucket) {
                throw "Need Amazon S3 bucket."
            }

            const machinelearning = new AWS.MachineLearning()

// console.log(machinelearning);

            const params = {
                /* DataSourceID is a user identified identifier */
                DataSourceId: "looker.integrations.aws_ml.1m",
                DataSpec: {
                    /* DataLocationS3 is the location in the s3 Bucket of the CSV for model training */
                    DataLocationS3: "s3://looker.instances/banking3.csv",
                    /* DataSchemaLocationS3 is the location of the json Schema --> this
                     * must be properly formatted json (down to the line spacing) for it to
                     * be parsed correctly by ML*/
                    DataSchemaLocationS3: "s3://looker.instances/schema5.schema",
                },
                /* ComputeStatistics must be set to true --> this allows us to use the data for later modeling*/
                ComputeStatistics: true,
                /* DataSourceName is the user selected name for the dataSource under the model */
                DataSourceName: "banking2.1m",
            }

            /* Depending on the type of data the mhe MLModelType can be linear, multiclass, or Binary Logistic
             * for ML */

            const model_params = {
                MLModelId: "banking2_logistic_regression.1m", /* required */
                MLModelType: "BINARY", /* required */
                TrainingDataSourceId: "looker.integrations.aws_ml.1m", /* required */
                MLModelName: "banking_binary_logistic.1m",
            }

            machinelearning.createDataSourceFromS3(params, function(err: any, data: any) {
                if (!err) {
                    winston.info(data)
                    machinelearning.createMLModel(model_params, function(err: any, data: any) {
                        if (err) reject(err, err.stack) // an error occurred
                        else     resolve(data)           // successful response
                    })
                } else {
                    winston.info(err, err.stack)
                }               // successful response
            })
        })
    }
}

D.addIntegration(new aws_ml())
