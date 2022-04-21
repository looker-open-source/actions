import * as Pq from "p-queue";
export declare abstract class ProcessQueue {
    queue: Pq;
    constructor();
    abstract run(data: string): Promise<string>;
}
