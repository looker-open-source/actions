import { expect } from "chai"
import { DomainValidator } from "./domain_validator"

describe("DomainValidator unit tests", () => {
  describe(".isValidEmailDomain", () => {
    it("returns true if an email address has a domain in the list", () => {
      expect(new DomainValidator("bar.com").isValidEmailDomain("foo@bar.com")).to.be.true
    })

    it("returns true if an email address has a domain in a list with multiple entries", () => {
      expect(new DomainValidator("baz.com,bar.com,foo.com").isValidEmailDomain("foo@bar.com")).to.be.true
    })

    it("returns true if domain list is empty", () => {
      expect(new DomainValidator("").isValidEmailDomain("foo@bar.com")).to.be.true
    })

    it("returns true if domain list is empty with multiple rows", () => {
      expect(new DomainValidator(",  , ").isValidEmailDomain("foo@bar.com")).to.be.true
    })

    it("ignores whitespace and empty rows in domain csv string", () => {
      expect(new DomainValidator("baz.com,  bar.com  ,, ,").isValidEmailDomain("foo@bar.com")).to.be.true
      expect(new DomainValidator("baz.com,  bar.com  ,, ,").isValidEmailDomain("foo@foo.com")).to.be.false
    })

    it("returns false if an email domain is not in the list", () => {
      expect(new DomainValidator("baz.com,bar.com").isValidEmailDomain("foo@foo.com")).to.be.false
      expect(new DomainValidator("foo.com,baz.com").isValidEmailDomain("foo.com@bar.com")).to.be.false
    })

    it("does not support regex", () => {
      expect(new DomainValidator("bar.+").isValidEmailDomain("foo@bar.com")).to.be.false
    })
  })

  describe(".hasValidDomains", () => {
    it("returns true if initialized with csv of non-whitespace characters", () => {
      expect(new DomainValidator("baz.com,bar.com, foo.com,   , , foo.net ").hasValidDomains()).to.be.true
    })

    it("returns false if initialized with csv of whitespace characters", () => {
      expect(new DomainValidator("").hasValidDomains()).to.be.false
      expect(new DomainValidator("  , ,,, , , , ,,,,     ").hasValidDomains()).to.be.false
    })
  })
})
