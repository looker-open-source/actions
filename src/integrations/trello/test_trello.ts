import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../framework"

import { TrelloIntegration } from "./trello"

const integration = new TrelloIntegration()

function expectTrelloPostMatch(request: D.ActionRequest, pathMatch: string, qsMatch: any) {

  const postSpy = sinon.spy(async (path: string, qs: any, cb: (err: any, res: any) => void) => {
    chai.expect(path).to.not.equal(null)
    chai.expect(qs).to.not.equal(null)
    cb(null, null)
  })

  const stubClient = sinon.stub(integration as any, "trelloClientFromRequest")
    .callsFake(() => {
      return {
        post: postSpy,
      }
    })

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(postSpy).to.have.been.calledWithMatch(pathMatch, qsMatch)
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("sends correct trello card", () => {
      const request = new D.ActionRequest()
      request.scheduledPlan = {url: "looker_url"}
      request.formParams = {
        list: "1",
        name: "mysummary",
        description: "mydescription",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectTrelloPostMatch(request, "/1/cards", {
        idList: request.formParams.list,
        name: request.formParams.name,
        desc: request.formParams.description,
        urlSource: request.scheduledPlan.url,
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with correct lists", (done) => {
      const boards = [
        {
          id: "b1",
          name: "bA",
          lists: [
            {
              id: "l1",
              name: "lA",
            },
          ],
        }, {
          id: "b2",
          name: "bB",
          lists: [
            {
              id: "l2",
              name: "lB",
            },
          ],
        },
      ]
      const stubClient = sinon.stub(integration as any, "trelloClientFromRequest")
        .callsFake(() => ({
          get: (_path: string, _qs: any, cb: (err: any, res: any) => void) => cb(null, boards),
        }))
      const request = new D.ActionRequest()
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          description: "Name of the Trello list to create a card.",
          label: "List",
          name: "list",
          options: [
            {
              name: boards[0].lists[0].id,
              label: `${boards[0].name}: ${boards[0].lists[0].name}`,
            }, {
              name: boards[1].lists[0].id,
              label: `${boards[1].name}: ${boards[1].lists[0].name}`,
            }],
          default: boards[0].lists[0].id,
          type: "select",
          required: true,
        }, {
          label: "Name",
          name: "name",
          type: "string",
          required: true,
        }, {
          label: "Description",
          name: "description",
          type: "textarea",
          required: true,
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })
  })

})
