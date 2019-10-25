import * as spawn from "child_process"
import * as winston from "winston"
import {ProcessQueue} from "./process_queue"

export class ExtendedProcessQueue extends ProcessQueue {
  PROCESS_TIMEOUT = 1000 * 60 * 120 // 2 hours in milliseconds
  DONE_MESSAGE = "PROCESS FINISHED"
  MAX_EXTENDED_CHILD_CONCURRENCY = 2
  childCounter = 0

  processTimeoutKiller(child: spawn.ChildProcess, webhookId: string, cbOuter: any, cbInner: any) {
    const msg = "Killed execute process due to timeout in responding to parent process"
    winston.warn(msg, {webhookId})
    if (!child.killed) {
      child.kill()
    }
    cbOuter(msg)
    cbInner()
  }

  async child_runner(child: spawn.ChildProcess,
                     data: string,
                     webhookId: string,
                     outerResolve: (value?: string | PromiseLike<string> | undefined) => void,
                     outerReject: (reason?: any) => void) {
    return new Promise<void>((res, rej) => {
      const timeout = setTimeout(this.processTimeoutKiller, this.PROCESS_TIMEOUT, child, webhookId, outerReject, rej)
      let succeeded = false
      child.on("message", (response) => {
        if (response !== this.DONE_MESSAGE) {
          outerResolve(response)
          winston.info(`execute process returning successful response to Looker`, {webhookId})
        }
        winston.info(`execute process finished successfully`, {webhookId})
        succeeded = true
        clearTimeout(timeout)
        child.kill()
        res()
      }).on("error", (err) => {
        clearTimeout(timeout)
        winston.warn(`execute process sent error message`, {webhookId, message: err.message})
        if (!child.killed) {
          child.kill()
        }
        outerReject(err)
        rej()
      }).on("exit", (code: number, signal: string) => {
        clearTimeout(timeout)
        if (!succeeded) {
          winston.warn(`execute process exited`, {webhookId, code, signal})
        }
        if (!child.killed) {
          child.kill()
        }
        outerReject(signal)
        rej()
      }).on("disconnect", () => {
        clearTimeout(timeout)
        if (!succeeded) {
          winston.info(`execute process disconnected`, {webhookId})
        }
        if (!child.killed) {
          child.kill()
        }
        outerReject("Child Disconnected")
        rej()
      }).on("close", (code: number, signal: string) => {
        clearTimeout(timeout)
        if (!succeeded) {
          winston.warn(`execute process closed`, {webhookId, code, signal})
        }
        if (!child.killed) {
          child.kill()
        }
        outerReject(signal)
        rej()
      })
      child.send(data)
    })
  }

  async run(data: string) {
    return this.queue.add(async () => {
      while (this.childCounter >= this.MAX_EXTENDED_CHILD_CONCURRENCY) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 1000 * 10)
        })
      }
      this.childCounter += 1
      return new Promise<string>((resolve, reject) => {
        const child = spawn.fork(`./src/xpc/execute_process.ts`)
        const webhookId = JSON.parse(data).webhookId
        winston.info(`execute process created`, {webhookId})
        this.child_runner(child, data, webhookId, resolve, reject).then(() =>
          this.childCounter -= 1
        ).catch(() =>
          this.childCounter -= 1
        )
      })
    })
  }
}
