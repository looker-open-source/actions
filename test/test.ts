import { expect } from "chai";

import * as Sources from "../src/sources";

Sources.allSources().forEach((source) => {

  describe(`${source.constructor.name}`, () => {
    it("should provide at least one destination", async () => {
      let destinations = await source.sourcedDestinations();
      expect(destinations).to.have.length.at.least(1);
    });
  });

})
