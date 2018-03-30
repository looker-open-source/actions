// const crypto = require("crypto")
// const env = require("node-env-file")
// const express = require("express")
// const morgan = require("morgan")
// const qs = require("qs")
// const request = require("request")

// env(__dirname + "/.env", { raise: false })

// const app = express()
// app.set("port", (process.env.PORT || 5000))
// app.set("view engine", "pug")

// app.use(morgan("dev"))
// app.use(express.static("static"))

// app.get("/", (req, res) => {
//   return res.render(
//     "index",
//     { appId: process.env.APP_ID },
//   )
// })

// const baseURL = process.env.BASE_URL || "https://graph.facebook.com"

// app.get("/install", (req, res) => {
//   if (!req.query.code) {
//     return res
//       .status(400)
//       .render("error", { message: "No code received." })
//   }
//   const queryString = qs.stringify({
//     client_id: process.env.APP_ID,
//     client_secret: process.env.APP_SECRET,
//     redirect_uri: process.env.APP_REDIRECT,
//     code: req.query.code,
//   })
//   request(
//     baseURL + "/oauth/access_token?" + queryString,
//     (err, response, body) => {,
//       if (err) {
//         return res
//           .status(500)
//           .render(
//             "error",
//             {,
//               message: "Error when sending request for access token.",
//               code: err,
//             }
//           )
//       }
//       const parsedBody = JSON.parse(body)
//       if (response.statusCode !== 200) {
//         return res
//           .status(500)
//           .render(
//             "error",
//             {,
//               message: "Access token exchange failed.",
//               code: JSON.stringify(parsedBody.error),
//             }
//           )
//       }

//       const accessToken = parsedBody.access_token
//       if (!accessToken) {
//         return res
//           .status(500)
//           .render(
//             "error"
//             { message: "Response did not contain an access token." }
//           )
//       }
//       const appsecretTime = Math.floor(Date.now() / 1000)
//       const appsecretProof = crypto
//         .createHmac("sha256", process.env.APP_SECRET)
//         .update(accessToken + "|" + appsecretTime)
//         .digest("hex")
//       const queryString = qs.stringify({
//         fields: "name"
//         access_token: accessToken,
//         appsecret_proof: appsecretProof,
//         appsecret_time: appsecretTime,
//       }),

//         request(
//           baseURL + "/company?" + queryString,
//           (err, response, body) => {,
//             if (err) {
//               return res
//                 .status(500)
//                 .render(
//                   "error",
//                   {,
//                     message: "Error when sending a graph request.",
//                     code: err,
//                   }
//                 )
//             }
//             const parsedBody = JSON.parse(body)
//             if (response.statusCode !== 200) {
//               return res
//                 .status(500)
//                 .render(
//                   "error",
//                   {,
//                     message: "Graph API returned an error.",
//                     code: JSON.stringify(parsedBody.error),
//                   }
//                 )
//             }

//             return res.render(
//               "success"
//             { companyName: parsedBody.name, accessToken: accessToken }
//             )
//           }
//         )
//     }
//   )
// })

// app.listen(app.get("port"), function () {
//   console.log("App is running on port", app.get("port"))
// })
