import PQueue from "p-queue";
export declare abstract class ProcessQueue {
    queue: PQueue;
    constructor();
    abstract run(data: string): Promise<string>;
}
