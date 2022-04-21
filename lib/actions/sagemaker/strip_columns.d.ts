export = StripColumns;
declare function StripColumns(numOfColumns: any): StripColumns;
declare class StripColumns {
    constructor(numOfColumns: any);
    _numOfColumns: any;
    _buffer: any;
    _transform(chunk: any, encoding: any, done: any): void;
}
