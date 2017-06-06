const googleAuth = require("google-auth-library");
const google = require("googleapis");

import * as D from "../framework";

D.addIntegration({
  name: "google_drive",
  label: "Google Drive",
  iconName: "google_drive.png",
  description: "Send download results directly to your Google Drive.",
  params: [
    {
      description: "An OAuth access token for Google APIs that's authorized to read and write files on Google Drive.",
      label: "Google API OAuth Token",
      name: "google_oauth_token",
      required: true,
      sensitive: true,
    },
  ],
  supportedActionTypes: ["query"],
  action: (request) => {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

      if (!request.attachment) {
        reject("No attachment.");
        return;
      }

      const auth  = googleClientFromRequest(request);
      const drive = google.drive("v3");

      drive.files.create({
        auth,
        fields: "id",
        media: {
          body: request.attachment.dataBuffer,
        },
        resource: {
          name: request.suggestedFilename(),
        },
      }, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(new D.DataActionResponse());
        }
      });
    });

  },

  form: (request) => {

    const promise = new Promise<D.DataActionForm>((resolve, reject) => {

        const auth = googleClientFromRequest(request);

        const drive = google.drive("v3");
        drive.files.list({
          auth,
          fields: "nextPageToken, files(id, name)",
          pageSize: 10,
        }, (err: any, response: any) => {

          if (err) {
            reject(err);
          }

          const form = new D.DataActionForm();

          form.fields = [{
            label: "Folder",
            name: "path",
            options: response.files.map((f: {id: string, name: string}) => {
              return {name: f.id, label: f.name};
            }),
            required: true,
            type: "select",
          }, {
            description: "Leave blank to use a suggested filename including the date and time.",
            label: "Filename",
            name: "filename",
          }];

          resolve(form);

        });

    });

    return promise;

  },
});

function googleClientFromRequest(request: D.DataActionRequest) {
  if (!request.params) {
    throw "No params provided.";
  }

  const accessToken = request.params.google_oauth_token;

  if (!accessToken) {
    throw "No google_oauth_token provided.";
  }

  const auth = new googleAuth();
  const oauth2 = new auth.OAuth2();
  oauth2.credentials = {access_token: accessToken};
  return oauth2;
}
