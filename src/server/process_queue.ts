import * as Pq from "p-queue"

export abstract class ProcessQueue {
    queue: Pq

    constructor() {
        this.queue = new Pq({concurrency: 1})
    }

    abstract async run(req: Express.Request, res: Express.Response): Promise<void>
}
