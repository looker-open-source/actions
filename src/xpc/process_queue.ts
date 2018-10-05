import * as Pq from "p-queue"

export abstract class ProcessQueue {
    queue: Pq

    constructor() {
        const concurrency = process.env.ACTION_HUB_HEAVY_PROCESS_COUNT ?
            parseInt(process.env.ACTION_HUB_HEAVY_PROCESS_COUNT, 10) : 1
        this.queue = new Pq({concurrency})
    }

    abstract async run(data: string): Promise<string>
}
