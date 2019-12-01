import * as winston from "winston"

const MINUTE_MS = 60000
const POLL_INTERVAL_MS = MINUTE_MS
const MAX_POLL_ATTEMPTS = 120
const POLL_TIMEOUT = MINUTE_MS * MAX_POLL_ATTEMPTS

export async function pollForCreateComplete(
  getJobStatus: () => Promise<string>,
  pollsRemaining: number = MAX_POLL_ATTEMPTS): Promise<void> {
  winston.debug("polls remaining ", pollsRemaining)
  if (pollsRemaining <= 0) {
    throw new Error(`resource creation did not complete within ${POLL_TIMEOUT / 1000} seconds`)
  }
  const jobStatus = await getJobStatus()

  if (jobStatus === "CREATE_FAILED") {
    throw new Error("resource creation failed")
  }

  if (!(jobStatus === "ACTIVE")) {
    // job not done, so sleep for POLL_INTERVAL_MS
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    return pollForCreateComplete(getJobStatus, pollsRemaining - 1)
  }
}
