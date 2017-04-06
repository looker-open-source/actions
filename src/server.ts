import * as express from "express";
import { allDestinations, findDestination } from "./destination_sources";
import { DataActionRequest } from './data_action_request';

export class Server {

  public app: express.Application;

  public static bootstrap(): Server {
    return new Server();
  }

  constructor() {

    this.app = express();

    this.app.get("/destinations", (req, res) => {
      allDestinations().then((destinations) => {
        res.send(JSON.stringify(destinations));
      });
    });

    this.app.get("/destinations/:destinationId", (req, res) => {
      findDestination(req.params.destinationId).then((destination) => {
        res.send(JSON.stringify(destination));
      });
    });

    this.app.get("/destinations/:destinationId/action", (req, res) => {
      findDestination(req.params.destinationId).then((destination) => {
        return destination.action(new DataActionRequest());
      }).then((dataActionResponse) => {
        res.send(dataActionResponse.asJson());
      });
    });

    this.app.get("/destinations/:destinationId/form", (req, res) => {

    });

  }

}
