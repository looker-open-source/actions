import * as chai from "chai";
import * as sinon from "sinon";

import * as Hub from "../../hub";
import { SegmentTrackAction } from "./segment_track";

const action = new SegmentTrackAction();
action.executeInOwnProcess = false;

describe(`${action.constructor.name} unit tests`, () => {
  describe("action", () => {
    it("calls track", () => {
      const HubspotCallspy = sinon.spy();
      const stubClient = sinon
        .stub(action as any, "segmentClientFromRequest")
        .callsFake(() => {
          return { track: HubspotCallspy, flush: (cb: () => void) => cb() };
        });
      const stubAnon = sinon
        .stub(action as any, "generateAnonymousId")
        .callsFake(() => "stubanon");

      const now = new Date();
      const clock = sinon.useFakeTimers(now.getTime());

      const request = new Hub.ActionRequest();
      request.formParams = {
        event: "funevent",
      };
      request.type = Hub.ActionType.Query;
      request.params = {
        hubspot_api_key: "mykey",
      };
      request.attachment = {
        dataBuffer: Buffer.from(
          JSON.stringify({
            fields: { dimensions: [{ name: "coolfield", tags: ["user_id"] }] },
            data: [{ coolfield: { value: "funvalue" } }],
          })
        ),
      };

      return chai
        .expect(action.validateAndExecute(request))
        .to.be.fulfilled.then(() => {
          chai.expect(HubspotCallspy).to.have.been.calledWithExactly({
            userId: "funvalue",
            anonymousId: null,
            event: "funevent",
            properties: {},
            context: {
              app: {
                name: "looker/actions",
                version: "dev",
              },
            },
            timestamp: now,
          });
          stubClient.restore();
          stubAnon.restore();
          clock.restore();
        });
    });
  });

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true);
    });
  });
});
