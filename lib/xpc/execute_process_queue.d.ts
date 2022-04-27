/// <reference types="node" />
import * as spawn from "child_process";
import { ProcessQueue } from "./process_queue";
export declare class ExecuteProcessQueue extends ProcessQueue {
    PROCESS_TIMEOUT: number;
    processTimeoutKiller(child: spawn.ChildProcess, webhookId: string, cb: any): void;
    run(data: string): Promise<string>;
}
