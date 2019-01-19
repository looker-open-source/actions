// import * as chai from "chai"
// // import * as sinon from "sinon"

// import * as Hub from "../../hub"

// import { SageMakerTrainAction } from "./sagemaker_train"

// const action = new SageMakerTrainAction()

// describe(`${action.constructor.name} unit tests`, () => {

//   describe("action", () => {

//     it("errors if there is no email address", () => {
//       const request = new Hub.ActionRequest()
//       request.formParams = {}
//       request.attachment = {}
//       request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

//       return chai.expect(action.execute(request)).to.eventually
//         .be.rejectedWith("Needs a valid email address.")
//     })

//     it("errors if the input has no attachment", () => {
//       const request = new Hub.ActionRequest()
//       request.formParams = {
//         to: "test@example.com",
//       }

//       return chai.expect(action.execute(request)).to.eventually
//         .be.rejectedWith("Couldn't get data from attachment")
//     })

//   })

//   describe("form", () => {

//     it("has form", () => {
//       chai.expect(action.hasForm).equals(true)
//     })

//   })

// })
