import * as D from "../framework";

import * as sanitizeFilename from "sanitize-filename";

import * as google from "googleapis";
import * as googleAuth from "google-auth-library";

export class GoogleDriveSource extends D.DestinationSource {

  async sourcedDestinations() {

    let dest = new D.Destination();
    dest.name = "google_drive";
    dest.label = "Google Drive";
    dest.description = "Send download results directly to your Google Drive.";
    dest.params = [
      {
        name: "google_oauth_token",
        label: "Google API OAuth Token",
        required: true,
        description: "An OAuth access token for Google APIs that's authorized to read and write files on Google Drive."
      }
    ];

    dest.action = function(request) {
      return new Promise<D.DataActionResponse>((resolve, reject) => {

        if (!request.attachment) {
          reject("No attachment.")
          return;
        }

        let auth  = googleClientFromRequest(request);
        let drive = google.drive("v3");

        drive.files.create({
          auth: auth,
          resource: {
            name: request.suggestedFilename()
          },
          media: {
            body: request.attachment.dataBuffer
          },
          fields: 'id'
        }, function(err, file) {
          if(err) {
            reject(err);
          } else {
            resolve(new D.DataActionResponse());
          }
        });
      });

    }

    dest.form = function(request) {

      let promise = new Promise<D.DataActionForm>((resolve, reject) => {

          let auth = googleClientFromRequest(request);

          let drive = google.drive("v3");
          drive.files.list({
            auth: auth,
            pageSize: 10,
            fields: "nextPageToken, files(id, name)"
          }, (err, response) => {

            if (err) {
              reject(err);
            }

            let form = new D.DataActionForm();

            form.fields = [{
              type: "select",
              label: "Folder",
              name: "path",
              required: true,
              options: response.files.map((f : {id, name}) => { return {name: f.id, label: f.name}}),
            }, {
              label: "Filename",
              name: "filename",
              description: "Leave blank to use a suggested filename including the date and time.",
            }];

            resolve(form);

          });

      });

      return promise;

    }

    return [dest];

  }

}

function googleClientFromRequest(request : D.DataActionRequest) {
  if (!request.params) {
    throw "No params provided.";
  }

  let accessToken = request.params["google_oauth_token"];

  if (!accessToken) {
    throw "No google_oauth_token provided.";
  }

  let auth = new googleAuth();
  let oauth2 = new auth.OAuth2();
  oauth2.credentials = {access_token: accessToken};
  return oauth2;
}
