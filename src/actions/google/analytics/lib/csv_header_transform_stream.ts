import { Transform, TransformCallback } from "stream"

/*
 * This class takes the csv formatted download stream from Looker and
 * changes the header line to the given value. Based on:
 *
 * https://nodejs.org/api/stream.html#stream_transform_transform_chunk_encoding_callback
 *
 * We make a few key assumptions:
 * 1. The data (chunk) is sent as a binary Buffer which can be converted to a string with utf-8 encoding
 *    - This is based on the convention of how Looker sends the data
 *
 * 2. The first chunk will contain the entirety of the original csv header row
 *    - This is reasonable since exports using this action should only be a couple columns wide
 *    - I haven't been able to create such a sitaution even with several dozen fields selected
 *    - The solution would be to accumulate chunks until a newline is detected
 *
 * 3. The original csv header row will not contain any escaped newline characters within a cell
 *    - THIS IS POSSIBLE TO BREAK, since the header line is formed from the lookml field label,
 *      and it is possible to insert a literal newline into the `label` param.
 *    - When this happens the resulting file will show an error in GA because
 *      it will fail csv parsing on the second line.
 *    - This is such a minute possibility, and one that is easy to detect and easy to correct by the customer,
 *      that it is not worth accounting for here, which would require implementing a streaming csv parser.
 */

export class CsvHeaderTransformStream extends Transform {
    firstChunkDone: boolean
    csvHeader: string

    constructor(csvHeader: string) {
      super()
      this.firstChunkDone = false
      this.csvHeader = csvHeader
    }

    _transform(chunk: Buffer, _: BufferEncoding, callback: TransformCallback) {
        if (this.firstChunkDone) {
            callback(undefined, chunk)
            return
        }

        let err
        try {
            const lines = chunk.toString("utf8").split("\n")
            lines[0] = this.csvHeader
            chunk = Buffer.from(lines.join("\n"))
        } catch (e) {
            err = e
        } finally {
            this.firstChunkDone = true
            callback(err, chunk)
        }
    }
}
