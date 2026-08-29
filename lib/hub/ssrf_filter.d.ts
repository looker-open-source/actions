import * as dns from "dns";
export declare const ALLOWED_PROTOCOLS: string[];
/** Returns true if `ip` is a literal address in restricted / non-public space. */
export declare function isRestrictedAddress(ip: string): boolean;
type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;
/**
 * A `dns.lookup` compatible function that errors if the host resolves to a
 * restricted address. Pass it as the `lookup` option of an outbound request so
 * the address the socket actually connects to is validated.
 */
export declare function ssrfSafeLookup(hostname: string, options: dns.LookupOneOptions | dns.LookupAllOptions | LookupCallback, callback?: LookupCallback): void;
/**
 * Synchronously validates the protocol and, when the host is an address
 * literal, that it is not restricted. This does not perform DNS resolution, so
 * it is safe to call before every request (including each redirect hop) even
 * when the connection itself is guarded by `ssrfSafeLookup`. A custom `lookup`
 * is only invoked for hostnames, so literal addresses must be checked here.
 */
export declare function assertAllowedRequestUrl(rawUrl: string): void;
/**
 * Validates that `rawUrl` uses an allowed protocol and does not resolve to a
 * restricted address. Throws a descriptive error otherwise. Intended for
 * callers that build a client library which cannot take a custom lookup.
 */
export declare function assertPublicUrl(rawUrl: string): Promise<void>;
export {};
