import * as D from "../framework";
import Dropbox = require("dropbox");

D.addIntegration({
  name: "dropbox",
  label: "Dropbox",
  iconName: "dropbox.png",
  description: "Send query results directly to a file in your Dropbox.",
  supportedActionTypes: ["query"],
  requiredFields: [],
  params: [
    {
      description: "An OAuth access token for the Dropbox API, created at https://www.dropbox.com/developers/apps.",
      label: "Dropbox Access Token",
      name: "dropbox_access_token",
      required: true,
    },
  ],
  action: async (request) => {

    let dropboxClient = dropboxClientFromRequest(request);

    if (request.type !== "query") {
      throw "Only query actions are supported.";
    }

    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment";
    }

    if (request.attachment && request.attachment.fileExtension) {

      let fileTitle = request.suggestedFilename();
      await dropboxClient.filesUpload({
        contents: request.attachment.dataBuffer,
        path: `/${fileTitle}`,
      });

    } else {
      throw "No attachment provided.";
    }

    return new D.DataActionResponse();
  },
  form: async (request) => {

    let dropboxClient = dropboxClientFromRequest(request);

    let files = await dropboxClient.filesListFolder({path: ""});
    let folders = files.entries.filter((file: any) => {
      return file[".tag"] === "folder";
    });

    let form = new D.DataActionForm();
    form.fields = [{
      label: "Folder",
      name: "path",
      options: folders.map((f: any) => {
        return {name: f.path_lower, label: f.path_display};
      }),
      required: true,
      type: "select",
    }, {
      description: "Leave blank to use a suggested filename including the date and time.",
      label: "Filename",
      name: "filename",
    }];

    return form;
  },
});

function dropboxClientFromRequest(request: D.DataActionRequest) {
  if (!request.params) {
    throw "No params provided.";
  }

  let accessToken = request.params.dropbox_access_token;

  if (!accessToken) {
    throw "No dropbox_access_token provided.";
  }

  return new Dropbox({accessToken});
}
