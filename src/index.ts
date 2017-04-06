import {Server} from "./server";

var app = Server.bootstrap().app;
var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log(`Destination server listening on port ${port}!`)
});
