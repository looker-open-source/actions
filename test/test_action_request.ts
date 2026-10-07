import * as chai from "chai"
import * as semver from "semver"
import {mockReq} from "sinon-express-mock"

import { ActionRequest } from "../src/hub"

describe("ActionRequest", () => {
  it("fromRequest correctly parses state from body", () => {
    const req = mockReq({
      headers: {
        "user-agent": "LookerOutgoingWebhook/7.3.0",
        "x-looker-webhook-id": "123",
        "x-looker-instance": "instanceId1",
      },
      body: {
        state: "someEncryptedStateString",
      },
    })

    // @ts-ignore
    req.header = (name: string): string | string[] | undefined => req.headers[name]

    const result = ActionRequest.fromRequest(req)
    chai.expect(result.fetchTokenState).to.equal("someEncryptedStateString")
  })

  it("fromRequest", () => {

    const req = mockReq({
      headers: {
        "user-agent": "LookerOutgoingWebhook/7.3.0",
        "x-looker-webhook-id": "123",
        "x-looker-instance": "instanceId1",
      },
    })

    // @ts-ignore
    req.header = (name: string): string | string[] | undefined => req.headers[name]

    const result = ActionRequest.fromRequest(req)
    chai.expect(result.webhookId).to.equal("123")
    chai.expect(result.instanceId).to.equal("instanceId1")
    chai.expect(result.lookerVersion).to.equal(semver.valid("7.3.0"))
    chai.expect(result.lookerVersion).to.not.be.null
  })

  it("fromRequest doesn't skip ", () => {

    const req = mockReq({
      headers: {
        // our internal version scheme including trailing 0s
        "user-agent": "LookerOutgoingWebhook/7.3.00004561",
        "x-looker-webhook-id": "123",
        "x-looker-instance": "instanceId1",
      },
    })

    // @ts-ignore
    req.header = (name: string): string | string[] | undefined => req.headers[name]

    const result = ActionRequest.fromRequest(req)
    chai.expect(result.webhookId).to.equal("123")
    chai.expect(result.instanceId).to.equal("instanceId1")
    chai.expect(result.lookerVersion).to.not.be.null
    chai.expect(result.lookerVersion).to.equal(semver.valid("7.3.4561"))
  })

  it("ActionRequest.suggestedFilename parses formParams if there's no attachment", () => {
    const formats = ["csv", "xlsx", "html", "txt", "json", "json_label", "inline_json", "json_detail"]
    const expectedExtensions = [".csv", ".xlsx", ".html", ".txt", ".json", ".json", ".json", ".json"]

    formats.map((format, i) => {
      const req = mockReq({
        headers: {
          "user-agent": "LookerOutgoingWebhook/7.3.0",
          "x-looker-webhook-id": "123",
          "x-looker-instance": "instanceId1",
        },
        body: {
          form_params: {format},
          scheduled_plan: {title: "Orders by County"},
        },
      })

      // @ts-ignore
      req.header = (name: string): string | string[] | undefined => req.headers[name]

      const result = ActionRequest.fromRequest(req)
      chai.expect(result.suggestedFilename()).to.equal(`Orders by County${expectedExtensions[i]}`)
    })
  })

  it("ActionRequest.completeFilename removes whitespace and adds extension to filename", () => {
    const formats = ["csv", "xlsx", "html", "txt", "pdf"]

    formats.map((format) => {
      const req = mockReq({
        headers: {
          "user-agent": "LookerOutgoingWebhook/7.3.0",
          "x-looker-webhook-id": "123",
          "x-looker-instance": "instanceId1",
        },
        body: {
          form_params: {format, filename: " foo baz bar "},
          scheduled_plan: {title: "Orders by County"},
          attachment: {extension: format},
        },
      })

      // @ts-ignore
      req.header = (name: string): string | string[] | undefined => req.headers[name]

      const result = ActionRequest.fromRequest(req)

      chai.expect(result.completeFilename()).to.equal(`foo_baz_bar.${format}`)
    })

    formats.map((format) => {
      const req = mockReq({
        headers: {
          "user-agent": "LookerOutgoingWebhook/7.3.0",
          "x-looker-webhook-id": "123",
          "x-looker-instance": "instanceId1",
        },
        body: {
          form_params: {format, filename: ` foo baz bar.${format}`},
          scheduled_plan: {title: "Orders by County"},
          attachment: {extension: format},
        },
      })

      // @ts-ignore
      req.header = (name: string): string | string[] | undefined => req.headers[name]

      const result = ActionRequest.fromRequest(req)

      chai.expect(result.completeFilename()).to.equal(`foo_baz_bar.${format}`)
    })

    formats.map((format) => {
      const req = mockReq({
        headers: {
          "user-agent": "LookerOutgoingWebhook/7.3.0",
          "x-looker-webhook-id": "123",
          "x-looker-instance": "instanceId1",
        },
        body: {
          form_params: {format, filename: ` foo baz bar .docx`},
          scheduled_plan: {title: "Orders by County"},
          attachment: {extension: format},
        },
      })

      // @ts-ignore
      req.header = (name: string): string | string[] | undefined => req.headers[name]

      const result = ActionRequest.fromRequest(req)

      chai.expect(result.completeFilename()).to.equal(result.suggestedFilename())
    })
  })
})

import * as http from "http"
import { AddressInfo } from "net"

describe("ActionRequest.stream SSRF mitigation", () => {
  async function listen(server: http.Server): Promise<number> {
    return new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port))
    })
  }

  async function streamAndCollect(downloadUrl: string) {
    const received: Buffer[] = []
    const request = new ActionRequest()
    request.scheduledPlan = { downloadUrl }
    let rejected = false
    try {
      await request.stream(async (readable) => {
        readable.on("data", (chunk: Buffer) => received.push(chunk))
        return "done"
      })
    } catch (e) {
      rejected = true
    }
    return { rejected, body: Buffer.concat(received).toString() }
  }

  it("refuses to stream a download url that points at an internal address", async () => {
    const internal = http.createServer((_req, res) => res.end("INTERNAL_SECRET"))
    const port = await listen(internal)
    try {
      const result = await streamAndCollect(`http://127.0.0.1:${port}/`)
      chai.expect(result.rejected).to.equal(true)
      chai.expect(result.body).to.not.contain("INTERNAL_SECRET")
    } finally {
      internal.close()
    }
  })

  it("refuses to follow a download url redirect that leads to an internal address", async () => {
    const internal = http.createServer((_req, res) => res.end("INTERNAL_SECRET"))
    const internalPort = await listen(internal)
    const redirector = http.createServer((_req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.1:${internalPort}/` })
      res.end()
    })
    const redirectorPort = await listen(redirector)
    try {
      const result = await streamAndCollect(`http://127.0.0.1:${redirectorPort}/`)
      chai.expect(result.rejected).to.equal(true)
      chai.expect(result.body).to.not.contain("INTERNAL_SECRET")
    } finally {
      internal.close()
      redirector.close()
    }
  })
})
