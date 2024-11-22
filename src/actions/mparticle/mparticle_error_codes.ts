export const mparticleErrorCodes: any = {
  202: "Accepted - The POST was accepted.",
  400: "Bad Request -	The request JSON was malformed JSON or had missing fields.",
  401: "Unauthorized - The authentication header is missing.",
  403: "Forbidden -	The authentication header is present, but invalid.",
  429: "Too Many Requests	- You have exceeded your provisioned limit. \
  We recommend retrying your request in an exponential backoff pattern",
  503: "Service Unavailable -	We recommend retrying your request in an \
  exponential backoff pattern",
}
