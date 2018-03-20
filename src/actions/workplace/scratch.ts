function log(...args: any[]) {
  console.log.apply(console, args)
}

const buffer = new Buffer([1, 2, 3, 4])

log("buffer", buffer.toString("base64"))
