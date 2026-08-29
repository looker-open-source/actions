"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_PROTOCOLS = void 0;
exports.isRestrictedAddress = isRestrictedAddress;
exports.ssrfSafeLookup = ssrfSafeLookup;
exports.assertAllowedRequestUrl = assertAllowedRequestUrl;
exports.assertPublicUrl = assertPublicUrl;
const dns = require("dns");
const net = require("net");
const url_1 = require("url");
/*
 * Central egress guard used to mitigate Server-Side Request Forgery (SSRF).
 *
 * Action Hub actions and the streaming subsystem make outbound HTTP requests to
 * hosts that are, in whole or in part, supplied in the inbound action request.
 * Without a guard, those requests can be pointed at loopback, link-local
 * (including the cloud metadata endpoint at 169.254.169.254) or private RFC 1918
 * address space. This module provides a single place to reject such targets.
 *
 * `ssrfSafeLookup` is a drop-in replacement for `dns.lookup` that rejects any
 * host that resolves to a restricted address. Passing it as the `lookup` option
 * of an outbound request validates the address the socket actually connects to,
 * which closes DNS-rebinding races. `assertPublicUrl` performs the same check
 * ahead of time for callers that use client libraries which cannot accept a
 * custom lookup. `assertAllowedRequestUrl` performs the synchronous protocol and
 * address-literal portion of that check.
 */
exports.ALLOWED_PROTOCOLS = ["http:", "https:"];
// Restricted IPv4 ranges expressed as [network, prefixLength]. These cover
// loopback, private, link-local, carrier-grade NAT, and other special-use
// blocks that outbound action traffic must never reach.
const RESTRICTED_IPV4_RANGES = [
    ["0.0.0.0", 8], // "this" network
    ["10.0.0.0", 8], // private
    ["100.64.0.0", 10], // carrier-grade NAT
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // link-local (incl. cloud metadata 169.254.169.254)
    ["172.16.0.0", 12], // private
    ["192.0.0.0", 24], // IETF protocol assignments
    ["192.0.2.0", 24], // TEST-NET-1
    ["192.88.99.0", 24], // 6to4 relay anycast
    ["192.168.0.0", 16], // private
    ["198.18.0.0", 15], // benchmarking
    ["198.51.100.0", 24], // TEST-NET-2
    ["203.0.113.0", 24], // TEST-NET-3
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4], // reserved / broadcast
];
function ipv4ToInt(ip) {
    const parts = ip.split(".").map((octet) => parseInt(octet, 10));
    return parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3];
}
function isRestrictedIpv4(ip) {
    const value = ipv4ToInt(ip);
    for (const [network, prefix] of RESTRICTED_IPV4_RANGES) {
        const rangeSize = Math.pow(2, 32 - prefix);
        const base = ipv4ToInt(network);
        if (value >= base && value < base + rangeSize) {
            return true;
        }
    }
    return false;
}
// If an IPv6 address embeds an IPv4 address (IPv4-mapped ::ffff:a.b.c.d or
// IPv4/IPv6 translation 64:ff9b::a.b.c.d), return the embedded IPv4 in dotted
// form so it can be checked against the IPv4 ranges.
function embeddedIpv4(ip) {
    const lower = ip.toLowerCase();
    const dotted = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) {
        return dotted[1];
    }
    const hex = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
        const high = parseInt(hex[1], 16);
        const low = parseInt(hex[2], 16);
        return `${Math.floor(high / 256)}.${high % 256}.${Math.floor(low / 256)}.${low % 256}`;
    }
    return undefined;
}
function isRestrictedIpv6(ip) {
    const lower = ip.toLowerCase().split("%")[0]; // strip any zone index
    if (lower === "::" || lower === "::1") {
        return true; // unspecified / loopback
    }
    const firstGroup = lower.split(":")[0];
    const firstHextet = firstGroup === "" ? 0 : parseInt(firstGroup, 16);
    if (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) {
        return true; // fc00::/7 unique local
    }
    if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) {
        return true; // fe80::/10 link-local
    }
    if (firstHextet >= 0xff00 && firstHextet <= 0xffff) {
        return true; // ff00::/8 multicast
    }
    return false;
}
/** Returns true if `ip` is a literal address in restricted / non-public space. */
function isRestrictedAddress(ip) {
    const host = ip.replace(/^\[|\]$/g, "");
    if (net.isIPv4(host)) {
        return isRestrictedIpv4(host);
    }
    if (net.isIPv6(host)) {
        const embedded = embeddedIpv4(host);
        if (embedded !== undefined && net.isIPv4(embedded)) {
            return isRestrictedIpv4(embedded);
        }
        return isRestrictedIpv6(host);
    }
    // Not a resolvable literal address; treat as restricted to fail closed.
    return true;
}
/**
 * A `dns.lookup` compatible function that errors if the host resolves to a
 * restricted address. Pass it as the `lookup` option of an outbound request so
 * the address the socket actually connects to is validated.
 */
function ssrfSafeLookup(hostname, options, callback) {
    const cb = (typeof options === "function" ? options : callback);
    const opts = (typeof options === "function" ? {} : options);
    dns.lookup(hostname, opts, (err, address, family) => {
        if (err) {
            return cb(err, address, family);
        }
        const resolved = Array.isArray(address)
            ? address.map((entry) => entry.address)
            : [address];
        const restricted = resolved.find((entry) => isRestrictedAddress(entry));
        if (restricted !== undefined) {
            return cb(new Error(`SSRF mitigation: refusing to connect to "${hostname}" which resolves to restricted address ${restricted}`), address, family);
        }
        cb(null, address, family);
    });
}
/**
 * Synchronously validates the protocol and, when the host is an address
 * literal, that it is not restricted. This does not perform DNS resolution, so
 * it is safe to call before every request (including each redirect hop) even
 * when the connection itself is guarded by `ssrfSafeLookup`. A custom `lookup`
 * is only invoked for hostnames, so literal addresses must be checked here.
 */
function assertAllowedRequestUrl(rawUrl) {
    let parsed;
    try {
        parsed = new url_1.URL(rawUrl);
    }
    catch (e) {
        throw `Unable to parse the request URL.`;
    }
    if (!exports.ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        throw `Refusing to make a request to a disallowed protocol "${parsed.protocol}".`;
    }
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) !== 0 && isRestrictedAddress(host)) {
        throw `Refusing to make a request to restricted address ${host}.`;
    }
}
/**
 * Validates that `rawUrl` uses an allowed protocol and does not resolve to a
 * restricted address. Throws a descriptive error otherwise. Intended for
 * callers that build a client library which cannot take a custom lookup.
 */
async function assertPublicUrl(rawUrl) {
    assertAllowedRequestUrl(rawUrl);
    const parsed = new url_1.URL(rawUrl);
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) !== 0) {
        // Already validated as an allowed literal by assertAllowedRequestUrl.
        return;
    }
    const resolved = await dns.promises.lookup(host, { all: true });
    if (resolved.length === 0) {
        throw `Unable to resolve host "${host}".`;
    }
    const restricted = resolved.find((entry) => isRestrictedAddress(entry.address));
    if (restricted !== undefined) {
        throw `Refusing to make a request to "${host}" which resolves to restricted address ${restricted.address}.`;
    }
}
