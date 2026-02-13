import { readFileSync, writeFileSync } from "fs";
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
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function getLastSeenId(handle: string): string | undefined {
  return state[handle];
}

export function setLastSeenId(handle: string, id: string): void {
  state[handle] = id;
}
