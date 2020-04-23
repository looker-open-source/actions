import * as winston from "winston"

export const DEFAULT_REGION = "us-east-1"

export function logRejection(err: any) {
  winston.debug(err)
}
