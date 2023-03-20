/// <reference types="node" />
import * as spawn from "child_process";
import { ProcessQueue } from "./process_queue";
export declare class ExtendedProcessQueue extends ProcessQueue {
    PROCESS_TIMEOUT: number;
    DONE_MESSAGE: string;
    MAX_EXTENDED_CHILD_CONCURRENCY: number;
    childCounter: number;
    processTimeoutKiller(child: spawn.ChildProcess, webhookId: string, lookerReponseCallback: any, processCallback: any): void;
    child_runner(child: spawn.ChildProcess, data: string, webhookId: string, lookerResponseResolve: (value: string | PromiseLike<string>) => void, lookerResponseReject: (reason?: any) => void): Promise<void>;
    run(data: string): Promise<string>;
}
