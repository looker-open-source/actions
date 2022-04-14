interface Task {
    id: number;
    run: any;
    result?: any;
    error?: any;
}
/**
 * Queue
 * helper to run 10 tasks at a time
 *
 * Usage:
 *
 * const queue = new Queue()
 *
 * queue.addTask(async fn)
 * queue.addTask(async fn)
 * queue.addTask(async fn)
 * queue.addTask(async fn)
 * ... add as many tasks as needed
 *
 * const completed = await queue.finish()
 *
 * `completed` is an array of objects with { result } or { error }
 * (the resolved result of each task or the rejected result)
 * the completed results will be in the same order as they were added
 *
 */
export declare class Queue {
    channelSize: number;
    counter: number;
    queue: Task[];
    channels: Task[];
    completed: Task[];
    finished: boolean;
    promise: Promise<Task[]>;
    resolve: any;
    constructor();
    addTask(run: any): void;
    checkQueue(): void;
    logState(): void;
    startTask(task: Task): void;
    completeTask(task: Task): void;
    finish(): Promise<Task[]>;
}
export {};
