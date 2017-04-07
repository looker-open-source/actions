import * as express from "express";
import { allDestinations, findDestination } from "./destination_sources";
import { DataActionRequest } from './data_action_request';
import { DataActionForm } from './data_action_form';

export class Server {

  public app: express.Application;

  public static bootstrap(): Server {
    return new Server();
  }

  public static absUrl(rootRelativeUrl : string) {
    return `${process.env.BASE_URL}${rootRelativeUrl}`;
  }

  route(path : string, fn : (req: express.Request, res: express.Response) => void) : void {
    this.app.get(path, async (req, res) => {
      try {
        await fn(req, res);
      } catch (e) {
        res.status(404);
        res.json({success: false, error: e});
      }
    })
  }

  constructor() {

    this.app = express();

    this.route("/destinations", async (req, res) => {
      let destinations = await allDestinations();
      res.json(destinations.map((d) => { return d.asJson() }));
    });

    this.route("/destinations/:destinationId", async (req, res) => {
      let destination = await findDestination(req.params.destinationId)
      res.json(destination.asJson());
    });

    this.route("/destinations/:destinationId/action", async (req, res) => {
      let destination = await findDestination(req.params.destinationId)
      if (destination.action) {
         let actionResponse = await destination.action(new DataActionRequest());
         res.json(actionResponse.asJson());
      } else {
        throw "No action defined for destination.";
      }
    });

    this.route("/destinations/:destinationId/form", async (req, res) => {
      let destination = await findDestination(req.params.destinationId)
      if (destination.form) {
         let form = await destination.form(new DataActionRequest());
         res.json(form.asJson());
      } else {
        throw "No form defined for destination.";
      }
    });

  }

}
