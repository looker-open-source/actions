export = StripColumns;
declare function StripColumns(numOfColumns: any): StripColumns;
declare class StripColumns {
    constructor(numOfColumns: any);
    _numOfColumns: any;
    _buffer: Buffer | undefined;
    _transform(chunk: any, encoding: any, done: any): void;
}
