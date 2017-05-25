import * as crypto from "crypto";

function digest(nonce: string) {
  return crypto.createHmac("sha512", process.env.INTEGRATION_SERVICE_SECRET.toString()).update(nonce).digest("hex");
}

export function fromNonce(nonce: string) {
  return `${nonce}/${digest(nonce)}`;
}

export function validate(key: string) {
  const [nonce, providedDigest] = key.split("/");
  if (!nonce || !providedDigest) {
    return false;
  }
  return crypto.timingSafeEqual(new Buffer(providedDigest), new Buffer(digest(nonce)));
}
