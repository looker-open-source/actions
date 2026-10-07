import * as chai from "chai"
import * as dns from "dns"
import * as sinon from "sinon"

import { assertPublicUrl, isRestrictedAddress, ssrfSafeLookup } from "../src/hub"

const expect = chai.expect

describe("ssrf_filter", () => {
  describe("isRestrictedAddress", () => {
    const restricted = [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1",
      "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
      "192.0.2.5", "198.51.100.7", "203.0.113.9",
      "::1", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1",
      "::ffff:127.0.0.1", "::ffff:169.254.169.254",
    ]
    const allowed = [
      "8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1",
      "::ffff:8.8.8.8", "2606:4700:4700::1111",
    ]

    restricted.forEach((ip) => {
      it(`treats ${ip} as restricted`, () => {
        expect(isRestrictedAddress(ip)).to.equal(true)
      })
    })

    allowed.forEach((ip) => {
      it(`treats ${ip} as allowed`, () => {
        expect(isRestrictedAddress(ip)).to.equal(false)
      })
    })
  })

  describe("assertPublicUrl", () => {
    afterEach(() => {
      sinon.restore()
    })

    it("rejects the cloud metadata address", () => {
      return expect(assertPublicUrl("http://169.254.169.254/latest/meta-data/")).to.be.rejected
    })

    it("rejects private ipv4 literals", () => {
      return expect(assertPublicUrl("https://10.0.0.5/x")).to.be.rejected
    })

    it("rejects ipv6 loopback literals", () => {
      return expect(assertPublicUrl("http://[::1]/")).to.be.rejected
    })

    it("rejects the file protocol", () => {
      return expect(assertPublicUrl("file:///etc/passwd")).to.be.rejected
    })

    it("rejects the ftp protocol", () => {
      return expect(assertPublicUrl("ftp://8.8.8.8/")).to.be.rejected
    })

    it("rejects a hostname that resolves to a restricted address", () => {
      sinon.stub(dns.promises, "lookup").resolves([{ address: "169.254.169.254", family: 4 }] as any)
      return expect(assertPublicUrl("https://metadata.internal.example/")).to.be.rejected
    })

    it("allows a hostname that resolves to a public address", () => {
      sinon.stub(dns.promises, "lookup").resolves([{ address: "93.184.216.34", family: 4 }] as any)
      return expect(assertPublicUrl("https://example.com/path")).to.be.fulfilled
    })
  })

  describe("ssrfSafeLookup", () => {
    afterEach(() => {
      sinon.restore()
    })

    it("errors when the host resolves to a restricted address", (done) => {
      sinon.stub(dns, "lookup").callsFake(((_h: any, _o: any, cb: any) => cb(null, "10.0.0.5", 4)) as any)
      ssrfSafeLookup("internal.example", {}, (err) => {
        expect(err).to.be.instanceOf(Error)
        done()
      })
    })

    it("passes through a public address", (done) => {
      sinon.stub(dns, "lookup").callsFake(((_h: any, _o: any, cb: any) => cb(null, "93.184.216.34", 4)) as any)
      ssrfSafeLookup("example.com", {}, (err, address) => {
        expect(err).to.equal(null)
        expect(address).to.equal("93.184.216.34")
        done()
      })
    })

    it("errors when any address in an `all` lookup is restricted", (done) => {
      sinon.stub(dns, "lookup").callsFake(((_h: any, _o: any, cb: any) =>
        cb(null, [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }])) as any)
      ssrfSafeLookup("rebind.example", { all: true }, (err) => {
        expect(err).to.be.instanceOf(Error)
        done()
      })
    })
  })
})
