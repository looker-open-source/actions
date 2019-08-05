import * as httpRequest from "request-promise-native"
import * as winston from "winston"
import * as Hub from "../../hub"
import { Poller, Transaction } from "./poller"

const AUGER_URL = "https://app.auger.com/api/v1"

export class AugerTrainAction extends Hub.Action {
  name = "auger"
  label = "Auger - AutoML Training"
  iconName = "auger/auger.png"
  description = "Send data to Auger to start training."
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  requiredFields = []
  params = [
    {
      name: "api_token",
      label: "Auger API Token",
      description: "API Token from https://app.auger.com/<organization_name>/settings",
      required: true,
      sensitive: true,
    },
  ]

  minimumSupportedLookerVersion = "5.24.0"

  async execute(request: Hub.ActionRequest) {
    try {
      const qr = this.validateParams(request)
      const rawName = qr.fields.dimensions ? qr.fields.dimensions[0].source_file.split(".")[0] : "looker_file"
      const fileName = `${rawName}_${Date.now()}`
      const records = this.formatJSON(qr)
      const projectName = request.formParams.project_name
      const filePath = `workspace/projects/${projectName}/files/${fileName}.json`
      const token = request.params.api_token
      const modelType = request.formParams.model_type

      const projectFileUrl = await this.getProjectFileURL(projectName, filePath, token)
      const projectId = projectFileUrl.body.data.project_id
      const mainBucket = projectFileUrl.body.data.main_bucket
      const url = projectFileUrl.body.data.url
      const s3Path = `s3://${mainBucket}/workspace/projects/${projectName}/files/${fileName}.json`
      await this.uploadToS3(records, url)
      const transaction: Transaction = {
        projectId,
        fileName,
        s3Path,
        token,
        url,
        modelType,
        records,
        augerURL: AUGER_URL,
        successStatus: "running",
        errorStatus: "",
        pollFunction: this.getProject.bind(this),
        callbackFunction: this.startProjectFile.bind(this),
        projectFileId: 0,
        experimentId: 0,
      }

      await this.startProject(transaction)
      this.startPoller(transaction)
      return new Hub.ActionResponse({ success: true })
    } catch (e) {
      return new Hub.ActionResponse({ success: false, message: e.message })
    }
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    if (!request.params.api_token) {
      form.error = "No Auger API Token configured; consult your Looker admin."
      return form
    }

    try {
      await this.validateAugerToken(request.params.api_token)
      form.fields = [
        {
          name: "project_name",
          label: "Project Name",
          required: true,
          description: "The Auger project to use.",
        },
        {
          name: "model_type",
          label: "Model Type",
          type: "select",
          default: "classification",
          required: true,
          options: [
            { name: "classification", label: "Classification" },
            { name: "regression", label: "Regression" },
          ],
        },
      ]
    } catch (e) {
      form.error = this.prettyAugerError(e)
    }

    return form
  }

  private async validateAugerToken(token: string) {
    try {
      await httpRequest.get({
        url: `${AUGER_URL}/user/`,
        qs: {token},
        json: true,
      }).promise()
    } catch (e) {
      throw new Error("Invalid token")
    }
  }

  private async getProjectFileURL(projectName: any, filePath: string, token: any): Promise<any> {
    try {
      const options = {
        url: `${AUGER_URL}/project_file_urls/`,
        body: {
          project_name: projectName,
          file_path: filePath,
          token,
        },
        json: true,
        resolveWithFullResponse: true,
      }
      return httpRequest.put(options).promise()
    } catch (e) {
      throw new Error(`project file url failed ${e}`)
    }
  }

  private async uploadToS3(records: string[], url: string): Promise<any> {
    try {
      const signedOptions = {
        url,
        body: records,
        json: true,
        resolveWithFullResponse: true,
      }
      return httpRequest.put(signedOptions).promise()
    } catch (e) {
      throw new Error(`project file not created ${e}`)
    }
  }

  private async startProject(transaction: Transaction): Promise<any> {
    try {
      const options = {
        method: "PATCH",
        url: `${transaction.augerURL}/projects/${transaction.projectId}/deploy`,
        body: {
          worker_type_id: 1,
          workers_count: 2,
          token: transaction.token,
        },
        json: true,
        resolveWithFullResponse: true,
      }
      return httpRequest(options).promise()
    } catch (e) {
      throw new Error(`project not started ${e}`)
    }
  }

  private async startProjectFile(transaction: Transaction): Promise<any> {
    const projectFile = await this.createProjectFile(transaction)
    transaction.successStatus = "processed"
    transaction.errorStatus = "processed_with_error"
    transaction.pollFunction = this.getProjectFile.bind(this)
    transaction.callbackFunction = this.startExperiment.bind(this)
    transaction.projectFileId = projectFile.body.data.id
    this.startPoller(transaction)
  }

  private async startExperiment(transaction: Transaction): Promise<any> {
    const experiment = await this.createExperiment(transaction)
    transaction.experimentId = experiment.body.data.id
    transaction.successStatus = "success"
    transaction.errorStatus = "error"
    transaction.pollFunction = this.getExperiment.bind(this)
    transaction.callbackFunction = this.startSession.bind(this)
    this.startPoller(transaction)
  }

  private async createProjectFile(transaction: Transaction): Promise<any> {
    try {
      const projOptions = {
        url: `${transaction.augerURL}/projects/${transaction.projectId}/files/`,
        json: true,
        resolveWithFullResponse: true,
        body: {
          project_id: transaction.projectId,
          file_name: `${transaction.fileName}.json`,
          name: transaction.fileName,
          url: transaction.s3Path,
          token: transaction.token,
        },
      }
      return httpRequest.post(projOptions).promise()
    } catch (e) {
      throw new Error(`project file not created: ${e}`)
    }
  }

  private async createExperiment(transaction: Transaction): Promise<any> {
    try {
      const options = {
        url: `${transaction.augerURL}/experiments/`,
        body: {
          project_id: transaction.projectId,
          name: `${transaction.fileName}_${Date.now()}`,
          project_file_id: transaction.projectFileId,
          token: transaction.token,
        },
        json: true,
        resolveWithFullResponse: true,
      }
      return httpRequest.post(options).promise()
    } catch (e) {
      throw new Error(`experiment start failed: ${e}`)
    }

  }

  private async getProjectFile(transaction: Transaction): Promise<any> {
    try {
      const options = {
        url: `${transaction.augerURL}/project_files/${transaction.projectFileId}?token=${transaction.token}`,
        json: true,
        resolveWithFullResponse: true,
      }
      winston.debug("get project", options)
      return httpRequest.get(options).promise()
    } catch (e) {
      throw new Error(`project file fetched: ${e}`)
    }
  }

  private async getExperiment(transaction: Transaction): Promise<any> {
    try {
      const options = {
        url: `${transaction.augerURL}/experiments/${transaction.experimentId}?token=${transaction.token}`,
        json: true,
        resolveWithFullResponse: true,
      }
      // winston.debug("get experiment", options)
      return httpRequest.get(options).promise()
    } catch (e) {
      throw new Error(`project file fetched: ${e}`)
    }
  }

  private async getProject(transaction: Transaction): Promise<any> {
    try {
      const projOptions = {
        url: `${transaction.augerURL}/projects/${transaction.projectId}?token=${transaction.token}`,
        json: true,
        resolveWithFullResponse: true,
      }
      // winston.debug("get project", projOptions)
      return httpRequest.get(projOptions).promise()
    } catch (e) {
      throw new Error(`project file not created: ${e}`)
    }
  }

  private async startSession(transaction: Transaction): Promise<any> {
    try {
      const options = {
        url: `${transaction.augerURL}/experiment_sessions/`,
        body: {
          experiment_id: transaction.experimentId,
          status: "preprocess",
          model_type: transaction.modelType,
          model_settings: this.formatModelSettings(transaction),
          token: transaction.token,
        },
        json: true,
        resolveWithFullResponse: true,
      }
      return httpRequest.post(options).promise()
    } catch (e) {
      throw new Error(`experiment start failed: ${e}`)
    }

  }

  private formatModelSettings(transaction: Transaction) {
    const keys = Object.keys(transaction.records[0])
    const dataLength = keys.length
    const features = keys.map((feature, index) => {
      if (dataLength === index + 1) {
        return { column_name: feature, isTarget: true}
      } else {
        return { column_name: feature }
      }
    })
    const modelSettings = {
      features,
      max_n_trials: 100,
    }
    return modelSettings
  }

  private startPoller(transaction: Transaction) {
    new Poller(transaction)
  }

  private prettyAugerError(e: Error) {
    if (e.message === "Invalid token") {
      return "Your Auger API token is invalid."
    }
    return e.message
  }

  private formatJSON(qr: any) {
    const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
    const fieldMap: any = {}
    for (const field of fields) {
      fieldMap[field.name] = field.name.split(".")[1]
    }
    const records = qr.data.map((row: any) => {

      const record: any = {}
      for (const field of fields) {
        record[fieldMap[field.name]] = row[field.name].value
      }
      return record
    })
    return records
  }

  private validateParams(request: Hub.ActionRequest) {
    if (!request.attachment || !request.attachment.dataJSON) {
      throw new Error("Couldn't get data from attachment")
    }

    const qr = request.attachment.dataJSON
    if (!qr.fields || !qr.data) {
      throw new Error("Request payload is an invalid format.")
    }
    const {
      project_name,
      model_type,
    } = request.formParams

    // validate string inputs
    if (!project_name) {
      throw new Error("Missing required param: project_name")
    }
    if (!model_type) {
      throw new Error("Missing required param: model_type")
    }
    return qr
  }

}

Hub.addAction(new AugerTrainAction())
