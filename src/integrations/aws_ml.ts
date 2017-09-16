/**
 * Created by joe on 9/13/17.
 */

import * as D from "../framework"
const AWS = require("aws-sdk")
const winston = require("winston");
AWS.config.update({region: "us-east-1"})

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

machinelearning.createDataSourceFromS3(params, function(err:any, data:any) {
    if (!err) {
        winston.info(data)
        machinelearning.createMLModel(model_params, function(err: any, data: any) {
            if (err) console.log(err, err.stack) // an error occurred
            else     console.log(data)           // successful response
        })
    } else {
        winston.info(err, err.stack)
    }               // successful response
})

D.addIntegration(new AmazonS3Integration())