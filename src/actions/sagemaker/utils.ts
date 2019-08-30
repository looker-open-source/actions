import * as winston from "winston"

export function logRejection(err: any) {
  winston.debug(err)
}
