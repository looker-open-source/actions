export function safeParseJson(str: string | undefined) {
  try {
    return JSON.parse(str ? str : "")
  } catch {
    return undefined
  }
}

export function isMochaRunning() {
  return ["afterEach", "after", "beforeEach", "before", "describe", "it"].every((functionName) => {
    return (global as any)[functionName] instanceof Function
  })
}
