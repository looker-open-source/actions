/* tslint:disable no-console */

function log(...args: any[]) {
  console.log(...args)
}

// function logJson(label: string, object: any) {
//   console.log("\n================================")
//   console.log(`${label}:\n`)
//   const json = `${JSON.stringify(object)}\n\n`
//   console.log(json)
// }

interface Task {
  id: number
  run: any
  result?: any
  error?: any
}

export class Queue {

  channelSize = 10
  counter: number
  queue: Task[]
  channels: Task[]
  completed: Task[]
  finished: boolean
  promise: any
  resolve: any

  constructor() {
    this.counter = 0
    this.queue = []
    this.channels = []
    this.completed = []
    this.finished = false

    this.promise = new Promise<Task[]>((resolve) => {
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

    // check if we have task in the queue
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
    log("- queue:", this.queue.length, "- channels", this.channels.length, "- completed", this.completed.length)
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

  finish() {
    this.finished = true
    return this.promise
  }

}
