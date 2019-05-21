const Transform = require("stream").Transform
const util = require("util")

function StripColumns(numOfColumns) {
    if (! (this instanceof StripColumns)) {
        return new StripColumns(numOfColumns)
    }
    Transform.call(this)
    this._numOfColumns = numOfColumns || 0
    this._buffer = Buffer.from("")
}

util.inherits(StripColumns, Transform)

StripColumns.prototype._transform = function(chunk, encoding, done) {

    // construct our working chunk
    // using the previous buffer (empty to start) and the incoming chunk
    const str = this._buffer.toString() + chunk.toString()

    // split that into lines
    const lines = str.split("\n")

    // the last line is either empty, or an incomplete line
    // pop that off and save it in our buffer for the next chunk of work
    const last_line = lines.pop()
    this._buffer = Buffer.from(last_line)

    // transform our lines
    // 1. convert each line to an array of values
    // 2. slice off the requested number of columns
    // 3. convert the array back into csv
    const transformed = lines.map((line) => {
        return line.split(",").slice(this._numOfColumns).join(",")
    })

    // push out the new chunk
    const transformed_chunk = Buffer.from(transformed.join("\n") + "\n")
    this.push(transformed_chunk)

    done()
}

module.exports = StripColumns
