import * as D from "../framework"

import * as sanitizeFilename from "sanitize-filename"
import * as URL from "url"
import {LookerAPIClient} from "./looker"
import {ISendGridEmail, SendGridIntegration} from "./sendgrid"

const TAG = "looker_dashboard_url"

/** Returns promise of NodeJS.Timer with a delay of ms milliseconds
 * @param {number} ms - milliseconds to wait
 */
async function delay(ms: number) {
  return new Promise<NodeJS.Timer>((resolve) => setTimeout((resolve), ms))
}

export class LookerDashboardAPIIntegration extends SendGridIntegration {

  constructor() {
    super()
    this.name = "looker_dashboard_api"
    this.label = "Looker Dashboard API"
    this.iconName = "looker.svg"
    this.description = "Send a result set to pull a pdf dashbord from the Looker API and send to an email via SendGrid."
    this.requiredFields = [{tag: TAG}]
    this.params = this.params.concat([
      {
        name: "base_url",
        label: "Looker API Url",
        required: true,
        sensitive: false,
        description: "e.g. https://instancename.looker.com:19999",
      },
      {
        name: "looker_api_client",
        label: "Looker API Client",
        required: true,
        sensitive: false,
        description: "https://github.com/looker/looker-sdk-ruby/blob/master/authentication.md",
      },
      {
        name: "looker_api_secret",
        label: "Looker API Secret",
        required: true,
        sensitive: true,
        description: "https://github.com/looker/looker-sdk-ruby/blob/master/authentication.md",
      },
    ])
    this.supportedActionTypes = ["cell", "query"]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.supportedVisualizationFormattings = ["noapply"]
  }

  /** Returns PDF content for a looker dashboard.
   *
   * 1. create render task to make pdf
   * response = /api/3.0/render_tasks/dashboards/2/pdf?width=1280&height=1
   * 2. check status on render task and wait if not yet sucess
   * task = /api/3.0/render_tasks/${response.id}
   * when status: "success"
   * 3. request pdf
   * response.body /api/3.0/render_tasks/${response.id}/results
   *
   * @param {DataActionRequest} request - request
   * @param {string} lookerUrl - dashboard url e.g. https://instancename.looker.com:19999/dashboards/2?User%20Name=test
   */
  async generatePDFDashboard(request: D.DataActionRequest, lookerUrl: string) {
    const lookerClient = this.lookerClientFromRequest(request)

    let body = {
      dashboard_style: "tiled",
    }
    const parsedLookerUrl = new URL.URL(lookerUrl)
    if (parsedLookerUrl.search) {
      body = Object.assign(body, {dashboard_filters: parsedLookerUrl.searchParams.toString()})
    }

    if (!parsedLookerUrl.pathname) {
      throw "Invalid Looker URL."
    }
    const lookerPath = `/api/3.0/render_tasks${parsedLookerUrl.pathname}/pdf?width=1280&height=1`
    // create pdf render task
    const renderTask = await lookerClient.postAsync(lookerPath, body)
    // wait for success
    let i = 0
    while (i < 5) {
      const renderTaskStatus = await lookerClient.getAsync(`/api/3.0/render_tasks/${renderTask.id}`)
      if (renderTaskStatus.status === "success") {
        break
      }
      await delay(3000)
      i++
    }
    // get PDF
    const renderTaskResponse = await lookerClient.getAsync(`/api/3.0/render_tasks/${renderTask.id}/results`)
    return renderTaskResponse.body
  }

  async action(request: D.DataActionRequest) {
    let lookerUrls: string[] = []
    switch (request.type) {
      case "query":
        if (!(request.attachment && request.attachment.dataJSON)) {
          throw "Couldn't get data from attachment."
        }

        const qr = request.attachment.dataJSON
        if (!qr.fields || !qr.data) {
          throw "Request payload is an invalid format."
        }
        const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
        const identifiableFields = fields.filter((f: any) =>
          f.tags && f.tags.some((t: string) => t === TAG),
        )
        if (identifiableFields.length === 0) {
          throw `Query requires a field tagged ${TAG}.`
        }
        lookerUrls = qr.data.map((row: any) => (row[identifiableFields[0].name].value))
        break
      case "cell":
        const value = request.params.value
        if (!value) {
          throw "Couldn't get data from attachment."
        }
        lookerUrls = [value]
        break
    }

    let response
    try {
      await Promise.all(lookerUrls.map(async (lookerUrl, i) => {
        const fullLookerUrl = new URL.URL(request.params.base_url + lookerUrl)
        const pdf = await this.generatePDFDashboard(request, fullLookerUrl.href)
        fullLookerUrl.port = ""
        const msg: ISendGridEmail = {
          to: request.formParams.email!,
          subject: request.scheduledPlan!.title!,
          from: "Looker <noreply@lookermail.com>",
          html: `<p><a href="${fullLookerUrl.href}">View this data in Looker</a></p><p>Results are attached</p>`,
          attachments: [{
            content: pdf,
            filename: sanitizeFilename(`${request.scheduledPlan!.title}_${i}.pdf`),
          }],
        }
        return this.sendEmailAsync(request, msg)
      }))
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return new D.DataActionResponse(response)

  }

  async form() {
    const form = new D.DataActionForm()
    form.fields = [{
      name: "email",
      label: "Email Address",
      description: "e.g. test@example.com",
      type: "string",
      required: true,
    }]
    return form
  }

  private lookerClientFromRequest(request: D.DataActionRequest) {
    return new LookerAPIClient({
      baseUrl: request.params.base_url!,
      clientId: request.params.looker_api_client!,
      clientSecret: request.params.looker_api_secret!,
    })
  }
}

D.addIntegration(new LookerDashboardAPIIntegration())
