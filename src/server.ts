import * as bodyParser from "body-parser";
import * as express from "express";

import * as D from "./framework";
import * as Sources from "./sources";

import * as winston from "winston";

export class Server {

  public static bootstrap() {
    return new Server();
  }

  public static absUrl(rootRelativeUrl: string) {
    return `${process.env.BASE_URL}${rootRelativeUrl}`;
  }

  public app: express.Application;

  constructor() {

    this.app = express();
    this.app.use(bodyParser.json({limit: "250mb"}));

    this.route("/", async (req, res) => {
      let destinations = await Sources.allDestinations();
      let response = {
        destinations: destinations.map((d) => { return d.asJson(); }),
        label: process.env.DESTINATION_PROVIDER_LABEL,
      };
      res.json(response);
    });

    this.route("/destinations/:destinationId", async (req, res) => {
      let destination = await Sources.findDestination(req.params.destinationId);
      res.json(destination.asJson());
    });

    this.route("/destinations/:destinationId/action", async (req, res) => {
      let destination = await Sources.findDestination(req.params.destinationId);
      if (destination.action) {
         let actionResponse = await destination.validateAndPerformAction(D.DataActionRequest.fromJSON(req.body));
         res.json(actionResponse.asJson());
      } else {
        throw "No action defined for destination.";
      }
    });

    this.route("/destinations/:destinationId/form", async (req, res) => {
      let destination = await Sources.findDestination(req.params.destinationId);
      if (destination.form) {
         let form = await destination.form(D.DataActionRequest.fromJSON(req.body));
         res.json(form.asJson());
      } else {
        throw "No form defined for destination.";
      }
    });

  }

  private route(path: string, fn: (req: express.Request, res: express.Response) => void): void {
    this.app.post(path, async (req, res) => {
      winston.info(`Starting request for ${req.url}`);
      try {
        await fn(req, res);
        winston.info(`Completed request for ${req.url}`);
      } catch (e) {
        winston.error(`Error on request for ${req.url}:`);
        if (typeof(e) === "string") {
          res.status(404);
          res.json({success: false, error: e});
          winston.error(e);
        } else {
          res.status(500);
          res.json({success: false, error: "Internal server error."});
          winston.error(e);
        }
      }
    });
  }

}
