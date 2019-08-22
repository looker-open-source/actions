import * as chai from "chai"
import * as sinon from "sinon"

import * as sanitizeFilename from "sanitize-filename"

import { ActionRequest} from "../src/hub"

describe("ActionRequest template filename", () => {

  const now = new Date()
  let clock: any
  beforeEach(() => {
    clock = sinon.useFakeTimers(now.getTime())
  })

  afterEach(() => {
    clock.restore()
  })

  const request = new ActionRequest()
  request.attachment = {
    dataBuffer: Buffer.from("1,2,3,4", "utf8"),
    fileExtension: "csv",
  }
  request.scheduledPlan = {
    url: "looker_url",
    title: "Looker_title",
    query: {
      id: 1,
      model: "looker_model",
      view: "looker_view",
      fields: ["a", "b"],
      pivots: ["pivot_a"],
      fill_fields: null,
      filter_expression: null,
      filters: {
        x: "xvalue",
        y: "yvalue",
      },
      sorts: ["a"],
      limit: "500",
      column_limit: "10",
      total: false,
      row_total: null,
      runtime: 10,
      vis_config: null,
      filter_config: null,
      visible_ui_sections: null,
      slug: null,
      dynamic_fields: null,
      client_id: null,
      share_url: null,
      url: "looker_url",
      expanded_share_url: null,
      query_timezone: "",
      has_table_calculations: false,
      can: {
        run: true,
      },
    },
  }

  it("template works with template, a schedule plan and query", async () => {
    const filename = await request.templatedFilename(`{{ title | downcase }}-{{ query.filters.x }}.csv`)
    chai.expect(filename)
      .to.equal("looker_title-xvalue.csv")
  })

  it("template works referring to a date format not from query", async () => {
    const filename = await request.templatedFilename(`{{ "now" | date: "%Y-%m-%d" }}.csv`)
    chai.expect(filename)
      .to.equal(`${new Date().toISOString().slice(0, 10)}.csv`)
  })

  it("returns suggested without template", async () => {
    const filename = await request.templatedFilename()
    chai.expect(filename)
      .to.equal(`Looker_title.csv`)
  })

  it("returns suggested without template schedulePlan", async () => {
    const emptyRequest = new ActionRequest()

    const filename = await emptyRequest.templatedFilename()
    chai.expect(filename)
      .to.equal(sanitizeFilename(`looker_file_${new Date().toISOString()}`))
  })

})
