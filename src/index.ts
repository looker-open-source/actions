import { Server } from "./server";

if (!process.env.BASE_URL) {
  throw new Error("No BASE_URL env var set.")
}

var app = Server.bootstrap().app;
var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log(`Destination server listening on port ${port}!`)
});
