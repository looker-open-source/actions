import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { DigitalOceanObjectStorageIntegration } from "../../src/integrations/digitalocean/digitalocean_object_storage"

const integration = new DigitalOceanObjectStorageIntegration()

describe(`${integration.constructor.name} unit tests`, () => {

  /* "action" function is not functionally different from AmazonS3Integration */

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with correct buckets", (done) => {

      const stubClient = sinon.stub(integration as any, "amazonS3ClientFromRequest")
        .callsFake(() => ({
          listBuckets: (params: any, cb: (err: any, res: any) => void) => {
            chai.expect(params).to.equal(null)
            const response = {
              Buckets: [
                {Name: "A"},
                {Name: "B"},
              ],
            }
            cb(null, response)
          },
        }))

      const request = new D.DataActionRequest()
      request.params = {access_key_id: "foo", secret_access_key: "bar", region: "nyc3"}
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Space Name",
          name: "bucket",
          required: true,
          options: [
            {name: "A", label: "A"},
            {name: "B", label: "B"},
          ],
          type: "select",
          default: "A",
        }, {
          label: "Path",
          name: "path",
          type: "string",
        }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }],
      }).and.notify(stubClient.restore).and.notify(done)

    })

  })

})
