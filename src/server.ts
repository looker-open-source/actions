import * as express from "express";
import * as bodyParser from "body-parser";

import * as D from "./framework";
import * as Sources from "./sources";

export class Server {

  public app: express.Application;

  public static bootstrap(): Server {
    return new Server();
  }

  public static absUrl(rootRelativeUrl : string) {
    return `${process.env.BASE_URL}${rootRelativeUrl}`;
  }

  route(path : string, fn : (req: express.Request, res: express.Response) => void) : void {
    this.app.post(path, async (req, res) => {
      console.info(`Starting request for ${req.url}`);
      try {
        await fn(req, res);
        console.info(`Completed request for ${req.url}`);
      } catch (e) {
        console.error(`Error on request for ${req.url}:`);
        if (typeof(e) === "string") {
          res.status(404);
          res.json({success: false, error: e});
          console.error(e);
        } else {
          res.status(500);
          res.json({success: false, error: "Internal server error."});
          console.error(e);
        }
      }
    })
  }

  constructor() {

    this.app = express();
    this.app.use(bodyParser.json({limit: "250mb"}));

    this.route("/destinations", async (req, res) => {
      let destinations = await Sources.allDestinations();
      let response = {
        label: process.env.DESTINATION_PROVIDER_LABEL,
        destinations: destinations.map((d) => { return d.asJson() }),
      };
      res.json(response);
    });

    this.route("/destinations/:destinationId", async (req, res) => {
      let destination = await Sources.findDestination(req.params.destinationId)
      res.json(destination.asJson());
    });

    this.route("/destinations/:destinationId/action", async (req, res) => {
      let destination = await Sources.findDestination(req.params.destinationId)
      if (destination.action) {
         let actionResponse = await destination.validateAndPerformAction(D.DataActionRequest.fromJSON(req.body));
         res.json(actionResponse.asJson());
      } else {
        throw "No action defined for destination.";
      }
    });

    this.route("/destinations/:destinationId/form", async (req, res) => {
      let destination = await Sources.findDestination(req.params.destinationId)
      if (destination.form) {
         let form = await destination.form(D.DataActionRequest.fromJSON(req.body));
         res.json(form.asJson());
      } else {
        throw "No form defined for destination.";
      }
    });

  }

}
