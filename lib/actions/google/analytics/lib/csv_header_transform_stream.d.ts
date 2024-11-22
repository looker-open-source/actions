/// <reference types="node" />
/// <reference types="node" />
import { Transform, TransformCallback } from "stream";
export declare class CsvHeaderTransformStream extends Transform {
    firstChunkDone: boolean;
    csvHeader: string;
    constructor(csvHeader: string);
    _transform(chunk: Buffer, _: BufferEncoding, callback: TransformCallback): void;
}
