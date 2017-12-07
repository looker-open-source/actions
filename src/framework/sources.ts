import { Action } from "./action"

const actions: Action[] = []

export function addAction(action: Action) {
  actions.push(action)
}

export async function allActions() {
  const whitelistNames = process.env.ACTION_WHITELIST
  if (typeof whitelistNames === "string" && whitelistNames.length > 0) {
    const whitelist = whitelistNames.split(",")
    return actions.filter((i) => whitelist.indexOf(i.name) !== -1)
  } else {
    return actions
  }
}

export async function findAction(id: string) {
  const all = await allActions()
  const action = all.filter((i) => i.name === id)[0]
  if (!action) {
    throw "No action found."
  }
  return action
}
