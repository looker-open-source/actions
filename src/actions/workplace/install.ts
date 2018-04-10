const qs = require("qs")
const request = require("request")

function renderError(error: any) {
  return `
    <html>
      <head>
        <title>An Error Occurred.</title>
        <link rel="stylesheet" href="/install/workplace/styles.css" />
      </head>
      <body class="error">
        <h1>Sorry, an error occurred:</h1>
        <div class="error-message">
          ${error.message}
        </div>
      </body>
    </html>
  `
}

function renderSuccess({ accessToken }: any) {
  /* tslint:disable */
  return `
    <html>
      <head>
        <title>Success</title>
        <link rel="stylesheet" href="/install/workplace/styles.css" />
      </head>
      <body class="success">
        <h1>Your Access Token:</h1>
        <div class="access-token">${accessToken}</div>

        <h2>Please copy and paste this token into the Workplace by Facebook Action config settings in your Looker instance.</h2>

        <img src="/install/workplace/instruction-1.png" alt="Edit Workplace by Facebook Action in Looker instance" />

        <img src="/install/workplace/instruction-2.png" alt="Paste Access Token and Save" />

      </body>
    </html>
  `
  /* tslint:enable */
}

// ported from https://github.com/jokr/workplace-demo-authentication
export function installWorkplace(req: any, res: any) {
  if (!req.query.code) {
    return res
      .status(400)
      .send(renderError({ message: "No code received." }))
  }
  const baseURL = process.env.FACEBOOK_GRAPH_URL || "https://graph.facebook.com"
  const tokenQueryString = qs.stringify({
    client_id: process.env.WORKPLACE_APP_ID,
    client_secret: process.env.WORKPLACE_APP_SECRET,
    redirect_uri: process.env.WORKPLACE_APP_REDIRECT,
    code: req.query.code,
  })
  request(
    baseURL + "/oauth/access_token?" + tokenQueryString,
    (tokenErr: any, tokenResponse: any, tokenBody: any) => {
      try {
        if (tokenErr) {
          return res
            .status(500)
            .send(renderError({
              message: "Error when sending request for access token.",
            }))
        }
        const parsedTokenBody = JSON.parse(tokenBody)
        if (tokenResponse.statusCode !== 200) {
          return res
            .status(500)
            .send(renderError({
              message: "Access token exchange failed.",
              code: JSON.stringify(parsedTokenBody.error),
            }))
        }

        const accessToken = parsedTokenBody.access_token
        if (!accessToken) {
          return res
            .status(500)
            .send(renderError({
              message: "Response did not contain an access token.",
            }))
        }

        return res.send(renderSuccess({
          accessToken,
        }))

      } catch (accessTokenRequestError) {
        // console.error(accessTokenRequestError)
        res.send(renderError({
          message: "Facebook Graph API returned an error.",
        }))
      }
    },
  )

}
