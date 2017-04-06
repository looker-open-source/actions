import * as express from "express";
import { allDestinations } from "./destination_sources";

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
      allDestinations().then((destinations) => {
        let dest = destinations.filter((d) => {
          return d.id == req.params.destinationId;
        })[0];
        res.send(JSON.stringify(dest));
      });
    });

    this.app.get("/destinations/:destinationId/form", (req, res) => {

    });

  }

}
