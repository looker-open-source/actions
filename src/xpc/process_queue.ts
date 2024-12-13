import PQueue from "p-queue"

export abstract class ProcessQueue {
    queue: PQueue

    constructor() {
        // Actions that haven't specified executeInOwnProcess will not
        // be affected by this process count
        const concurrency = process.env.ACTION_HUB_EXECUTE_PROCESS_COUNT ?
            parseInt(process.env.ACTION_HUB_EXECUTE_PROCESS_COUNT, 10) : 1
        this.queue = new PQueue({concurrency})
    }

    abstract run(data: string): Promise<string>
}
