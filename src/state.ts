import { readFileSync, writeFileSync, renameSync } from "fs";
import { resolve } from "path";
import { LastSeenMap } from "./types";

const STATE_FILE = resolve(process.cwd(), "last-seen.json");

let state: LastSeenMap = {};

export function loadLastSeen(): void {
  try {
    state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    state = {};
  }
}

export function saveLastSeen(): void {
  const tmpFile = STATE_FILE + ".tmp";
  writeFileSync(tmpFile, JSON.stringify(state, null, 2));
  renameSync(tmpFile, STATE_FILE);
}

export function getLastSeenId(handle: string): string | undefined {
  return state[handle];
}

export function setLastSeenId(handle: string, id: string): void {
  state[handle] = id;
}
