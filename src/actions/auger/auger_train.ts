import * as httpRequest from "request-promise-native"
import * as semver from "semver"
import * as winston from "winston"
import * as Hub from "../../hub"
import { FileInfo, Poller, Transaction } from "./poller"
import { Queue } from "./queue"

const AUGER_URL = "https://app.auger.ai/api/v1"
const MAX_TOTAL_TIME_MINS = "60"
const MAX_N_TRIALS = "100"
const MAX_FILE_ROWS = 10000

export class AugerTrainAction extends Hub.Action {
  name = "auger"
  label = "Auger - AutoML Training"
  iconName = "auger/auger.png"
  description = "Send data to Auger to start training."
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  requiredFields = []
  usesStreaming = true
  executeInOwnProcess = true
  extendedAction = true
  params = [
    {
      name: "api_token",
      label: "Auger API Token",
      description: "API Token from https://app.auger.com/<organization_name>/settings",
      required: true,
      sensitive: true,
    },
    {
      name: "max_n_trials",
      label: "Max number of trials",
      description: "The maximum number of trials to run on your data training",
      required: false,
      sensitive: false,
    },
    {
      name: "max_total_time_mins",
      label: "Max training time minutes",
      description: "Maximum time alloted to train your data in minutes",
      required: false,
      sensitive: false,
    },
  ]

  minimumSupportedLookerVersion = "5.24.0"
  supportedFormats = (request: Hub.ActionRequest) => {
    if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
      return [Hub.ActionFormat.JsonDetailLiteStream]
    } else {
      return [Hub.ActionFormat.JsonDetail]
    }
  }

  async execute(request: Hub.ActionRequest) {
    try {
      this.validateParams(request)
      const transaction: Transaction = {
        projectId: 0,
        token: "",
        s3Path: "",
        fileName: "",
        columns: [],
        params: {},
        contentType: "application/json",
        augerURL: AUGER_URL,
        successStatus: "running",
        errorStatus: "",
        pollFunction: this.getProject.bind(this),
        callbackFunction: this.startProjectFile.bind(this),
        projectFileId: 0,
        experimentId: 0,
      }

      await this.processStream(request, transaction)

      try {
        await this.startProject(transaction)
      } catch (e) {
        if (e.name === "StatusCodeError") {
          winston.debug("project already started")
        } else {
          throw new Error(`project start failed ${e}`)
        }
      }
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
      if (!request.params.max_n_trials) {
        request.params.max_n_trials =  MAX_N_TRIALS
      }
      form.fields = [
        {
          name: "project_name",
          label: "Project Name",
          required: true,
          type: "string",
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
        {
          name: "max_n_trials",
          label: "Trials to run",
          type: "string",
          default: request.params.max_n_trials,
          required: false,
          description: "How many trials to run for training.",
        },
        {
          name: "train_data",
          label: "Train after data transfer",
          type: "select",
          default: "false",
          required: false,
          options: [
            { name: "true", label: "True" },
            { name: "false", label: "False" },
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

  private async chunkToS3(fileInfo: FileInfo, transaction: Transaction): Promise<any> {
    const projectFileUrl = await this.getProjectFileURL(fileInfo.projectName, fileInfo.filePath, fileInfo.token)
    transaction.projectId = projectFileUrl.body.data.project_id
    const mainBucket = projectFileUrl.body.data.main_bucket
    const url = projectFileUrl.body.data.url

    transaction.s3Path = `s3://${mainBucket}/workspace/projects/${fileInfo.projectName}/files/${fileInfo.fileName}.json`
    winston.debug("calling upload to s3")
    const recordsFormatted = this.formatRecords(fileInfo.chunkRecords, fileInfo.allFields, fileInfo.fieldMap)
    await this.uploadToS3(recordsFormatted, url)
  }

  private async processStream(request: Hub.ActionRequest, transaction: Transaction): Promise<any>  {
    transaction.params = this.formatParams(request.formParams)
    const projectName = request.formParams.project_name
    transaction.token = request.params.api_token
    let records: Hub.JsonDetail.Row[] = []
    let fileNumber = 1
    let fieldMap: any = {}
    let allFields: any[] = []
    const queue = new Queue()

    const sendChunk = (lastCall: boolean) => {
      transaction.contentType = "multipart"
      let filePath = `workspace/projects/${projectName}/files/${transaction.fileName}/${fileNumber}.json`
      // if single file then don't chunk file names
      if (lastCall && fileNumber === 1) {
        transaction.contentType = "application/json"
        filePath = `workspace/projects/${projectName}/files/${transaction.fileName}.json`
      }

      fileNumber += 1
      let fileInfo: FileInfo
      fileInfo = {
        fileName: transaction.fileName,
        projectName,
        filePath,
        token: transaction.token,
        chunkRecords: records.slice(0),
        allFields,
        fieldMap,
      }
      // upload chunk to s3
      const task = async () => this.chunkToS3(fileInfo, transaction)
      records = []
      queue.addTask(task)
    }

    await request.streamJsonDetail({
      onFields: (fields) => {
        const res = this.formatFields(fields)
        allFields = res.allFields
        fieldMap = res.fieldMap
        transaction.fileName = fields.dimensions ? fields.dimensions[0].source_file.split(".")[0] : "looker_file"
        transaction.fileName = `${transaction.fileName}_${Date.now()}`
      },
      onRow: (row) => {
        transaction.columns = row
        records.push(row)
        if (records.length > MAX_FILE_ROWS ) {
          sendChunk(false)
        }
      },
    })
    // send final records if any
    if (records.length > 0) {
      sendChunk(true)
    }
    const completed = await queue.finish()
    winston.debug("completed is:", completed)
  }

  private formatFields(allFields: any) {
    const fields: any[] = [].concat(...Object.keys(allFields).map((k) => allFields[k]))
    const fieldMap: any = {}
    for (const field of fields) {
      fieldMap[field.name] = field.name.split(".")[1]
    }
    return { fieldMap, allFields: fields }
  }

  private formatRecords(data: any, fields: any, fieldMap: any) {
    const records = data.map((row: any) => {
      const record: any = {}
      for (const field of fields) {
        record[fieldMap[field.name]] = row[field.name].value
      }
      return record
    })
    return records
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
          cluster_autoterminate_minutes: 10,
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
    if (transaction.params.train_data === "true") {
      transaction.callbackFunction = this.startExperiment.bind(this)
    } else {
      transaction.callbackFunction = undefined
    }
    transaction.projectFileId = projectFile.body.data.id
    this.startPoller(transaction)
  }

  private async startExperiment(transaction: Transaction): Promise<any> {
    const experiment = await this.createExperiment(transaction)
    transaction.experimentId = experiment.body.data.id
    await this.startSession(transaction)
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
          content_type: transaction.contentType,
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
          model_type: transaction.params.model_type,
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
    const keys = Object.keys(transaction.columns)
    const dataLength = keys.length
    const features = keys.map((feature, index) => {
      const featureSplit = feature.split(".")[1]
      if (dataLength === index + 1) {
        return { column_name: featureSplit, isTarget: true}
      } else {
        return { column_name: featureSplit }
      }
    })
    const modelSettings = {
      features,
      max_n_trials: Number(transaction.params.max_n_trials),
      max_total_time_mins: Number(transaction.params.max_total_time_mins),
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

  private formatParams(params: any) {
    if (!params.max_n_trials) {
      params.max_n_trials =  MAX_N_TRIALS
    }
    if (!params.max_total_time_mins) {
      params.max_total_time_mins = MAX_TOTAL_TIME_MINS
    }
    return params
  }

  private validateParams(request: Hub.ActionRequest) {
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
  }
}

Hub.addAction(new AugerTrainAction())
