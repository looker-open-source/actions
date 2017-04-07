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

  constructor() {

    this.app = express();

    this.app.get("/destinations", (req, res) => {
      allDestinations().then((destinations) => {
        res.send(JSON.stringify(destinations.map((d) => {return d.asJson()})));
      });
    });

    this.app.get("/destinations/:destinationId", (req, res) => {
      findDestination(req.params.destinationId).then((destination) => {
        res.send(JSON.stringify(destination.asJson()));
      });
    });

    this.app.get("/destinations/:destinationId/action", (req, res) => {
      findDestination(req.params.destinationId).then((destination) => {
        if (destination.action) {
           return destination.action(new DataActionRequest());
        } else {
          return Promise.reject("No action defined for destination.");
        }
      }).then((dataActionResponse) => {
        res.send(dataActionResponse.asJson());
      }, (err) => {
        res.status(404);
        res.send(JSON.stringify({success: false, error: err}))
      });
    });

    this.app.get("/destinations/:destinationId/form", (req, res) => {
      findDestination(req.params.destinationId).then((destination) => {
        if (destination.form) {
           return destination.form(new DataActionForm());
        } else {
          return Promise.reject("No form defined for destination.");
        }
      }).then((form) => {
        res.send(form.asJson());
      }, (err) => {
        res.status(404);
        res.send(JSON.stringify({success: false, error: err}))
      });
    });

  }

}
