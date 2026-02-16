import { readFileSync } from "fs";
import { resolve } from "path";
import { config as loadEnv } from "dotenv";
import { AppConfig, CookieEditorEntry } from "./types";

loadEnv();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

function loadJsonFile<T>(filename: string): T {
  const path = resolve(process.cwd(), filename);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    console.error(`Failed to read ${filename}: ${(err as Error).message}`);
    process.exit(1);
  }
}

export function loadConfig(): AppConfig {
  const discordBotToken = requireEnv("DISCORD_BOT_TOKEN");
  const discordChannelId = requireEnv("DISCORD_CHANNEL_ID");
  const discordGuildId = requireEnv("DISCORD_GUILD_ID");
  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || "30000", 10);
  const pollOffsetMs = parseInt(process.env.POLL_OFFSET_MS || "0", 10);

  const rawHandles = loadJsonFile<string[]>("handles.json");
  if (!Array.isArray(rawHandles) || rawHandles.length === 0) {
    console.error("handles.json must be a non-empty array of Twitter handles");
    process.exit(1);
  }
  const allHandles = rawHandles.map((h) => h.replace(/^@/, ""));

  const singleHandle = process.env.HANDLE?.replace(/^@/, "");
  const handles = singleHandle ? [singleHandle] : allHandles;

  const cookies = loadJsonFile<CookieEditorEntry[]>("cookies.json");
  const cookieNames = new Set(cookies.map((c) => c.name));
  if (!cookieNames.has("auth_token") || !cookieNames.has("ct0")) {
    console.error(
      "cookies.json must contain auth_token and ct0 cookies. Re-export from Cookie-Editor.",
    );
    process.exit(1);
  }

  return {
    discordBotToken,
    discordChannelId,
    discordGuildId,
    handles,
    cookies,
    pollIntervalMs,
    pollOffsetMs,
    singleHandle,
  };
}
