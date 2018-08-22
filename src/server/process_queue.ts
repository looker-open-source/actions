import * as Pq from "p-queue"

export abstract class ProcessQueue {
    queue: Pq

    constructor() {
        this.queue = new Pq({concurrency: 1})
    }

    abstract async run(data: string): Promise<string>
}
