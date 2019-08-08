import * as chai from "chai"
import * as httpRequest from "request-promise-native"
import * as sinon from "sinon"
// import * as winston from "winston"
import * as Hub from "../../hub"
import { Transaction } from "./poller"

import { AugerTrainAction } from "./auger_train"

const action = new AugerTrainAction()
const sandbox = sinon.createSandbox()
const now = new Date()
const clock = sinon.useFakeTimers(now.getTime())
describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {
    let stubHttpPost: sinon.SinonStub
    let stubStartProject: sinon.SinonStub
    let stubPoller: sinon.SinonStub
    let stubUploadToS3: sinon.SinonStub
    let stubProjectFile: sinon.SinonStub

    afterEach(() => {
      stubHttpPost.restore()
      stubStartProject.restore()
      stubPoller.restore()
      stubUploadToS3.restore()
      sandbox.restore()
      clock.restore()
    })

    it("sends the right body with URL", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params.api_token = "token"
      request.formParams = {
        model_type: "classification",
        project_name: "lookerproj",
      }

      const postSpy = sinon.spy((params: any) => {
        chai.expect(params.url).to.equal("https://app.auger.com/api/")
        chai.expect(params.headers.Authorization).to.equal("Token token")
        chai.expect(params.body.model_type).to.equal("classification")
        chai.expect(params.body.project_name).to.equal("lookerproj")
        return {
          promise: async () => new Promise<void>((resolve: any) => resolve()),
        }
      })
      stubHttpPost = sinon.stub(httpRequest, "post").callsFake(postSpy)
      stubPoller = sinon.stub(action as any, "startPoller")
      stubStartProject = sinon.stub(action as any, "startProject")
      stubUploadToS3 = sinon.stub(action as any, "uploadToS3")

      chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
        chai.expect(postSpy).to.have.been.called
        chai.expect(stubPoller, "stubPoller").to.have.been.called
        chai.expect(stubStartProject, "stubStartProject").to.have.been.called
        chai.expect(stubUploadToS3, "stubUploadToS3").to.have.been.called
      })
    })

    it("fails with bad data", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params.api_token = "token"
      request.formParams = {
        model_type: "classification",
        project_name: "lookerproj",
      }
      request.attachment = { dataJSON: {fields: []}}

      return chai.expect(action.execute(request))
        .to.be.fulfilled
        .then((result) => {
          chai.expect(result.success, "result.success").to.be.false
          chai.expect(result.message, "result.message").to.equal("Request payload is an invalid format.")
        })
    })

    it("sends with good data", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params.api_token = "token"
      request.formParams = {
        model_type: "classification",
        project_name: "lookerproj",
      }
      const fields = [
        { name: "distribution_centers.name", source_file: "05_distribution_centers.view.lkml"},
        { name: "distribution_centers.cost", source_file: "05_distribution_centers.view.lkml"},
        { name: "distribution_centers.is_sold", source_file: "05_distribution_centers.view.lkml"},
      ]

      const data = [
        {
          "distribution_centers.name": { value: "Charleston SC" },
          "distribution_centers.cost": { value: 4.995899754 },
          "distribution_centers.is_sold": { value: "Yes" },
        },
        {
          "distribution_centers.name": { value: "Charleston SC" },
          "distribution_centers.cost": { value: 6.720799786 },
          "distribution_centers.is_sold": { value: "Yes" },
        },
        {
          "distribution_centers.name": { value: "Charleston SC" },
          "distribution_centers.cost": { value: 15.625000047 },
          "distribution_centers.is_sold": { value: "Yes" },
        },
        {
          "distribution_centers.name": { value: "Charleston SC" },
          "distribution_centers.cost": { value: 13.125000009 },
          "distribution_centers.is_sold": { value: "No" },
        },
      ]
      request.attachment = {
        dataJSON: {
          fields,
          data,
        },
      }

      const url = "https://testhost.com"
      stubProjectFile = sinon.stub(action as any, "getProjectFileURL")
      .callsFake(() => ({
        body: {
          data: {
            project_id: 1,
            main_bucket: "main_bucket",
            url,
          },
        },
      }))

      stubPoller = sinon.stub(action as any, "startPoller")
      stubStartProject = sinon.stub(action as any, "startProject")
      stubUploadToS3 = sinon.stub(action as any, "uploadToS3")

      const augerURL = "https://app.auger.ai/api/v1"
      const rawName = "looker_file"
      const fileName = `${rawName}_${Date.now()}`
      const records = [
        { name: "Charleston SC", cost: 4.995899754, is_sold: "Yes" },
        { name: "Charleston SC", cost: 6.720799786, is_sold: "Yes" },
        { name: "Charleston SC", cost: 15.625000047, is_sold: "Yes" },
        { name: "Charleston SC", cost: 13.125000009, is_sold: "No" },
      ]
      const projectName = request.formParams.project_name
      const filePath = `workspace/projects/${projectName}/files/${fileName}.json`
      const token = request.params.api_token
      const modelType = request.formParams.model_type
      const projectId = 1
      const mainBucket = "main_bucket"
      const s3Path = `s3://${mainBucket}/workspace/projects/${projectName}/files/${fileName}.json`
      const transaction: Transaction = {
        projectId,
        fileName,
        s3Path,
        token,
        url,
        modelType,
        records,
        augerURL,
        successStatus: "running",
        errorStatus: "",
        projectFileId: 0,
        experimentId: 0,
      }

      return chai.expect(action.execute(request))
        .to.be.fulfilled
        .then(() => {
          chai.expect(stubPoller, "stubPoller").to.have.been.called
          chai.expect(stubUploadToS3, "stubUploadToS3").to.have.been.calledWithMatch(records, url)
          chai.expect(stubStartProject, "stubStartProject").to.have.been.calledWithMatch(transaction)
          chai.expect(stubProjectFile, "stubProjectFile").to.have.been.calledWithMatch(projectName, filePath, token)
        })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with project_name, model_type param", () => {
      const stubGet = sinon.stub(action, "validateAugerToken" as any).callsFake(async () => {
        return new Promise<any>((resolve: any) => resolve())
      })

      const request = new Hub.ActionRequest()
      request.params.api_token = "token"
      const form = action.validateAndFetchForm(request)

      chai.expect(form).to.eventually.deep.equal({
        fields: [
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
            name: "project_name",
            label: "Project Name",
            type: "text",
            required: true,
          },
        ],
      })

      stubGet.restore()
    })

  })
})
