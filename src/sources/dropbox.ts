import * as D from "../framework";

import Dropbox = require("dropbox");

export class DropboxSource extends D.DestinationSource {

  async sourcedDestinations() {

    let dest = new D.Destination();
    dest.name = "dropbox";
    dest.label = "Dropbox";
    dest.description = "Send download results directly to your Dropbox.";
    dest.supportedActionTypes = ["query"];
    dest.params = [
      {
        name: "dropbox_access_token",
        label: "Dropbox Access Token",
        required: true,
        description: "An OAuth access token for the Dropbox API, created at https://www.dropbox.com/developers/apps."
      }
    ];

    dest.action = async function(request) {

      let dropboxClient = dropboxClientFromRequest(request);

      if (request.type != "query") {
        throw "Only query actions are supported.";
      }

      if (request.attachment && request.attachment.fileExtension) {

        let fileTitle = request.suggestedFilename();
        let uploadResponse = await dropboxClient.filesUpload({
          path: `/${fileTitle}`,
          contents: request.attachment.dataBuffer,
        });

      } else {
        throw "No attachment provided.";
      }

      return new D.DataActionResponse();
    }

    dest.form = async function(request) {

      let dropboxClient = dropboxClientFromRequest(request);

      var files = await dropboxClient.filesListFolder({path: ""});
      var folders = files.entries.filter((file: any) => {
        return file[".tag"] == "folder";
      });

      let form = new D.DataActionForm();
      form.fields = [{
        type: "select",
        label: "Folder",
        name: "path",
        required: true,
        options: folders.map((f : any) => { return {name: f.path_lower, label: f.path_display}}),
      }, {
        label: "Filename",
        name: "filename",
        description: "Leave blank to use a suggested filename including the date and time.",
      }];

      return form;
    }

    return [dest];
  }

}

function dropboxClientFromRequest(request : D.DataActionRequest) {
  if (!request.params) {
    throw "No params provided.";
  }

  let accessToken = request.params["dropbox_access_token"];

  if (!accessToken) {
    throw "No dropbox_access_token provided.";
  }

  return new Dropbox({
    accessToken: accessToken,
  });
}
