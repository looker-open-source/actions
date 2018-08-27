import * as chai from "chai"

import * as Hub from "../src/hub"

describe("ActionRequest", () => {

  describe("inBatches", () => {

    it("automatically errors for lack of required parameters", () => {
      let batchCount = 1

      const req = new Hub.ActionRequest()
      const prom = req.inBatches(3, async (enqueue) => {
        enqueue("a")
        enqueue("b")
        enqueue("c")
        enqueue("d")
        enqueue("e")
        enqueue("f")
        enqueue("g")
        enqueue("g")
        enqueue("g")
        enqueue("g")
        enqueue("g")
        enqueue("g")
        enqueue("g")
        enqueue("g")
      },
      async (batch) => {
        console.log(batch)
        if (batchCount === 1) {
          chai.expect(batch).to.deep.eq(["a", "b", "c"])
        } else if (batchCount === 2) {
          chai.expect(batch).to.deep.eq(["d", "e", "f"])
        } else if (batchCount === 3) {
          chai.expect(batch).to.deep.eq(["d", "e", "f"])
        } else {
          chai.assert(false, "too many batches")
        }
        batchCount++
      })
      // TODO: haven't figured out error handling
      prom.catch((e) => {
        console.log(`catch 4 ${e}`)
      })
      chai.expect(prom).to.eventually.be.fulfilled.and.notify(() => {
        console.log( "FWAEJFWEFEW")
        chai.assert(batchCount === 3, "expected 3 batches")
      })
    })
  })

})
