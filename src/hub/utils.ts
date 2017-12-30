export function truncateString(s: string, limit: number, split = "\n") {
  if (s.length > limit) {
    // truncate to max limit characters
    s = s.substring(0, limit)
    // re-trim if we are in the middle of a line
    if (s.lastIndexOf(split) > 0) {
      s = s.substring(0, Math.min(s.length, s.lastIndexOf(split) + 1))
    }
  }
  return s
}
