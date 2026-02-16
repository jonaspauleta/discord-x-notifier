import { readFileSync, writeFileSync, renameSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { LastSeenMap } from "./types";

const LEGACY_STATE_FILE = resolve(process.cwd(), "last-seen.json");
const STATE_DIR = resolve(process.cwd(), "last-seen");

let state: LastSeenMap = {};
let stateFile = LEGACY_STATE_FILE;

export function loadLastSeen(singleHandle?: string): void {
  if (singleHandle) {
    stateFile = resolve(STATE_DIR, `${singleHandle}.json`);
    try {
      state = JSON.parse(readFileSync(stateFile, "utf-8"));
    } catch {
      // Migration: try reading handle's entry from legacy last-seen.json
      try {
        const legacy: LastSeenMap = JSON.parse(readFileSync(LEGACY_STATE_FILE, "utf-8"));
        if (legacy[singleHandle]) {
          state = { [singleHandle]: legacy[singleHandle] };
        } else {
          state = {};
        }
      } catch {
        state = {};
      }
    }
  } else {
    stateFile = LEGACY_STATE_FILE;
    try {
      state = JSON.parse(readFileSync(stateFile, "utf-8"));
    } catch {
      state = {};
    }
  }
}

export function saveLastSeen(): void {
  mkdirSync(dirname(stateFile), { recursive: true });
  const tmpFile = stateFile + ".tmp";
  writeFileSync(tmpFile, JSON.stringify(state, null, 2));
  renameSync(tmpFile, stateFile);
}

export function getLastSeenId(handle: string): string | undefined {
  return state[handle];
}

export function setLastSeenId(handle: string, id: string): void {
  state[handle] = id;
}
