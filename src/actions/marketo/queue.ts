import * as winston from "winston"

interface Task {
  id: number
  run: any
  result?: any
  error?: any
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
export class Queue {

  channelSize: number
  counter: number
  queue: Task[]
  channels: Task[]
  completed: Task[]
  finished: boolean
  promise: Promise<Task[]>
  resolve: any

  constructor() {
    this.channelSize = 10 // TODO make this configurable?
    this.counter = 0
    this.queue = []
    this.channels = []
    this.completed = []
    this.finished = false

    // create our promise which will get returned when the consumer calls queue.finish()
    // stash the resolver so we can use it later
    // is there a better way to do this?
    this.promise = new Promise((resolve) => {
      this.resolve = resolve
    })
  }

  addTask(run: any) {
    const task: Task = {
      id: this.counter++,
      run,
    }
    this.queue.push(task)
    this.checkQueue()
  }

  checkQueue() {
    // check if we're finished
    if (
      this.finished
      && this.queue.length === 0
      && this.channels.length === 0
    ) {
      this.logState()
      // sort completed items by id so they're in the same order as we received them
      this.completed.sort((a: Task, b: Task) => a.id - b.id)
      this.resolve(this.completed)
      return
    }

    // check if we have any tasks in the queue
    // and room to start a new one
    if (
      this.queue.length > 0
      && this.channels.length < this.channelSize
    ) {
      // pull a task off the queue
      const task = this.queue.shift()
      if (task) {
        this.startTask(task)
      }
    }

    this.logState()
  }

  logState() {
    winston.debug(
      "- queue:",
      this.queue.length,
      "- channels",
      this.channels.length,
      "- completed",
      this.completed.length,
    )
  }

  startTask(task: Task) {
    this.channels.push(task)

    task.run()
    .then((result: any) => {
      task.result = result
      this.completeTask(task)
    })
    .catch((error: any) => {
      task.error = error
      this.completeTask(task)
    })
  }

  completeTask(task: Task) {
    this.completed.push(task)
    this.channels = this.channels.filter((item) => item !== task)
    this.checkQueue()
  }

  async finish() {
    this.finished = true
    return this.promise
  }

}
