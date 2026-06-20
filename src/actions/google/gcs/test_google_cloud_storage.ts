import * as chai from "chai"
import * as sinon from "sinon"
import { Stream } from "stream"

import * as Hub from "../../../hub"

import { GoogleCloudStorageAction } from "./google_cloud_storage"

const action = new GoogleCloudStorageAction()

const BUCKET_FIELD_DESCRIPTION = "Buckets visible to the service account in its configured project." +
  " Leave blank and use the manual override below to write to a bucket in another project."
const BUCKET_OVERRIDE_FIELD = {
  label: "Bucket name (manual override)",
  name: "bucket_override",
  type: "string",
  description: "Optional. Exact GCS bucket name to write to; takes precedence over the dropdown." +
    " Use this for cross-project delivery where the service account only has" +
    " storage.objects.create on the target bucket and cannot list buckets.",
}
const FILENAME_FIELD = {
  label: "Filename",
  name: "filename",
  type: "string",
  description: "Optional. Supports UTC date tokens: {YYYYMMDD}, {YYYY}, {MM}, {DD}." +
    " GCS object names may contain \"/\", so you can date-partition into folders," +
    " e.g. \"daily/report_{YYYYMMDD}.csv\" becomes \"daily/report_20260617.csv\".",
}
const OVERWRITE_FIELD = {
  label: "Overwrite",
  name: "overwrite",
  options: [{label: "Yes", name: "yes"}, {label: "No", name: "no"}],
  default: "yes",
  description: "If Overwrite is enabled, will use the title or filename and overwrite existing data." +
    " If disabled, a date time will be appended to the name to make the file unique.",
}

function expectGoogleCloudStorageMatch(request: Hub.ActionRequest,
                                       bucketMatch: string,
                                       fileMatch: string,
                                       fileSaveMatch: Buffer,
                                       stubNow = true) {

  const createWriteStreamSpy = sinon.spy(async () => {
    let data = Buffer.from("")
    const stream = new Stream()
    stream
      .on("data", (chunk: any) => {
        data = Buffer.concat([data, chunk])
      })
      .on("finish", () => {
        chai.expect(data).to.equal(fileSaveMatch)
      })
    return stream
  })
  const fileSpy = sinon.spy(() => ({createWriteStream: createWriteStreamSpy}))
  const bucketSpy = sinon.spy(() => ({file: fileSpy}))

  const stubClient = sinon.stub(action as any, "gcsClientFromRequest")
    .callsFake(() => ({
      bucket: bucketSpy,
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")
  // When the caller has installed fake timers (sinon.useFakeTimers), Date.now is already replaced,
  // so stubbing it again would throw. Such callers pass stubNow = false.
  const stubDate = stubNow ? sinon.stub(Date, "now").callsFake(() => 1234) : undefined
  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
    chai.expect(bucketSpy).to.have.been.calledWithMatch(bucketMatch)
    chai.expect(fileSpy).to.have.been.calledWithMatch(fileMatch)
    stubClient.restore()
    stubSuggestedFilename.restore()
    if (stubDate) {
      stubDate.restore()
    }
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no bucket", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.validateAndExecute(request)).to.eventually
        .deep.equal({
          refreshQuery: false,
          success: false,
          error: {
            documentation_url: "TODO",
            http_code: 400,
            location: "ActionContainer",
            message: "Server cannot process request due to client request error. [Google Cloud Storage] needs a GCS bucket specified.",
            status_code: "BAD_REQUEST",
          },
          message: "Server cannot process request due to client request error. [Google Cloud Storage] needs a GCS bucket specified.",
          validationErrors: [],
          webhookId: undefined,
        })
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
      }

      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith(
          "A streaming action was sent incompatible data. The action must have a download url or an attachment.")
    })

    it("errors if there is an upload error", (done) => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      request.webhookId = "webhookId"
      const createWriteStreamSpy = sinon.spy(async () => Promise.reject(new Error("testReason")))
      const stubRequest = sinon.stub(request, "stream").callsFake(createWriteStreamSpy)

      const resp = action.validateAndExecute(request)
      chai.expect(resp).to.eventually.deep.equal({
        success: false,
        message: "Internal server error. [Google Cloud Storage] testReason",
        refreshQuery: false,
        validationErrors: [],
        error: {
          documentation_url: "TODO",
          http_code: 500,
          location: "ActionContainer",
          message: "Internal server error. [Google Cloud Storage] testReason",
          status_code: "INTERNAL",
        },
        webhookId: "webhookId",
      }).and.notify(stubRequest.restore).and.notify(done)
    })

    it("sends right body to filename and bucket", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "mybucket",
        "stubSuggestedFilename",
        Buffer.from("1,2,3,4", "utf8"))
    })

    it("sends to right filename if specified and overwrite yes", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
        filename: "mywackyfilename",
        overwrite: "yes",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "mybucket",
        "mywackyfilename",
        Buffer.from("1,2,3,4", "utf8"))
    })

    it("sends to right filename if specified and overwrite no", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
        filename: "mywackyfilename",
        overwrite: "no",
      }

      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "mybucket",
        "mywackyfilename_1234",
        Buffer.from("1,2,3,4", "utf8"))
    })

    it("sends to right filename if specified and overwrite no with attachment extension", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
        filename: "mywackyfilename.csv",
        overwrite: "no",
      }

      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
          "mybucket",
          "mywackyfilename_1234.csv",
          Buffer.from("1,2,3,4", "utf8"))
    })
    it("sends to right filename if specified and overwrite no with attachment with multiple .", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
        filename: "mywackyfilename.carl.csv",
        overwrite: "no",
      }

      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
          "mybucket",
          "mywackyfilename.carl_1234.csv",
          Buffer.from("1,2,3,4", "utf8"))
    })

    it("substitutes the {YYYYMMDD} date token in the filename", () => {
      const clock = sinon.useFakeTimers({ now: Date.UTC(2026, 5, 17), toFake: ["Date"] })
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
        filename: "report_{YYYYMMDD}.csv",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "mybucket",
        "report_20260617.csv",
        Buffer.from("1,2,3,4", "utf8"),
        false).then(() => clock.restore())
    })

    it("substitutes date tokens combined with path segments into a folder key", () => {
      const clock = sinon.useFakeTimers({ now: Date.UTC(2026, 5, 17), toFake: ["Date"] })
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
        filename: "daily/{YYYY}/{MM}/report_{DD}.csv",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "mybucket",
        "daily/2026/06/report_17.csv",
        Buffer.from("1,2,3,4", "utf8"),
        false).then(() => clock.restore())
    })

    it("leaves a filename with no date tokens unchanged", () => {
      const clock = sinon.useFakeTimers({ now: Date.UTC(2026, 5, 17), toFake: ["Date"] })
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
        filename: "plain_report.csv",
        overwrite: "yes",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "mybucket",
        "plain_report.csv",
        Buffer.from("1,2,3,4", "utf8"),
        false).then(() => clock.restore())
    })

    it("substitutes date tokens before appending the overwrite timestamp", () => {
      const clock = sinon.useFakeTimers({ now: Date.UTC(2026, 5, 17), toFake: ["Date"] })
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
        filename: "report_{YYYYMMDD}.csv",
        overwrite: "no",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "mybucket",
        `report_20260617_${Date.UTC(2026, 5, 17)}.csv`,
        Buffer.from("1,2,3,4", "utf8"),
        false).then(() => clock.restore())
    })

    it("uses the bucket_override value in preference to the dropdown bucket", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "listedbucket",
        bucket_override: "partner-bucket",
        filename: "mywackyfilename",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "partner-bucket",
        "mywackyfilename",
        Buffer.from("1,2,3,4", "utf8"))
    })
  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with correct buckets", (done) => {

      const stubClient = sinon.stub(action as any, "gcsClientFromRequest")
        .callsFake(() => ({
          getBuckets: async () => Promise.resolve([[
              {id: "1", name: "A"},
              {id: "2", name: "B"},
            ]]),
        }))

      const request = new Hub.ActionRequest()
      request.params = {
        client_email: "foo",
        private_key: "foo",
        project_id: "foo",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Bucket",
          name: "bucket",
          required: false,
          options: [
            {name: "1", label: "A"},
            {name: "2", label: "B"},
          ],
          type: "select",
          description: BUCKET_FIELD_DESCRIPTION,
          default: "1",
        },
          BUCKET_OVERRIDE_FIELD,
          FILENAME_FIELD,
          OVERWRITE_FIELD,
        ],
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("renders form with manual override when no buckets are listed", (done) => {

      const stubClient = sinon.stub(action as any, "gcsClientFromRequest")
        .callsFake(() => ({
          getBuckets: async () => Promise.resolve([[]]),
        }))

      const request = new Hub.ActionRequest()
      request.params = {
        client_email: "foo",
        private_key: "foo",
        project_id: "foo",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Bucket",
          name: "bucket",
          required: false,
          options: [],
          type: "select",
          description: BUCKET_FIELD_DESCRIPTION,
        },
          BUCKET_OVERRIDE_FIELD,
          FILENAME_FIELD,
          OVERWRITE_FIELD,
        ],
      }).and.notify(stubClient.restore).and.notify(done)
    })

  })

  it("renders form with manual override when listing buckets fails", (done) => {

    const stubClient = sinon.stub(action as any, "gcsClientFromRequest")
      .callsFake(() => ({
        getBuckets: async () => Promise.reject(new Error("something weird from your friends at google")),
      }))

    const request = new Hub.ActionRequest()
    request.params = {
      client_email: "foo",
      private_key: "foo",
      project_id: "foo",
    }
    const form = action.validateAndFetchForm(request)
    chai.expect(form).to.eventually.deep.equal({
      fields: [{
        label: "Bucket",
        name: "bucket",
        required: false,
        options: [],
        type: "select",
        description: BUCKET_FIELD_DESCRIPTION,
      },
        BUCKET_OVERRIDE_FIELD,
        FILENAME_FIELD,
        OVERWRITE_FIELD,
      ],
    }).and.notify(stubClient.restore).and.notify(done)
  })

})
