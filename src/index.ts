import { loadConfig } from "./config";
import {
  loadLastSeen,
  saveLastSeen,
  getLastSeenId,
  setLastSeenId,
} from "./state";
import { TwitterClient } from "./twitter";
import { DiscordNotifier } from "./discord";
import { NormalizedTweet, FetchResult } from "./types";

const config = loadConfig();
const twitter = new TwitterClient();
const discord = new DiscordNotifier();

const FAILURE_ALERT_THRESHOLD = 5;
const FAILURE_REALERT_INTERVAL = 50;
const AUTH_CHECK_INTERVAL = 10;

const failureCounts = new Map<string, number>();
let pollCycleCount = 0;

async function pollHandle(handle: string): Promise<void> {
  const lastSeenId = getLastSeenId(handle);

  const result = await withTimeout(
    twitter.fetchLatestTweet(handle),
    15000,
  ).catch((err): FetchResult & { error?: string } => {
    console.error(`[${handle}] Fetch failed: ${(err as Error).message}`);
    return { status: "empty", error: (err as Error).message };
  });

  if (result.status === "empty") {
    const count = (failureCounts.get(handle) || 0) + 1;
    failureCounts.set(handle, count);
    const hasError = "error" in result;
    console.log(`[${handle}] ${hasError ? "Fetch error" : "No tweet found"} (consecutive failures: ${count})`);

    if (count === FAILURE_ALERT_THRESHOLD || (count > FAILURE_ALERT_THRESHOLD && count % FAILURE_REALERT_INTERVAL === 0)) {
      const reason = hasError ? `Error: ${(result as any).error}` : "Scraper returned zero non-pinned tweets";
      await discord.sendWarning(
        `Fetch failures for @${handle}`,
        `${count} consecutive poll failures.\n${reason}`,
      ).catch((err) => console.error(`Failed to send warning: ${(err as Error).message}`));
    }
    return;
  }

  failureCounts.set(handle, 0);
  const tweet = result.tweet;

  if (lastSeenId && BigInt(tweet.id) <= BigInt(lastSeenId)) return;

  console.log(`[${handle}] New tweet: ${tweet.id}`);
  await sendTweet(tweet);
  setLastSeenId(handle, tweet.id);
  saveLastSeen();
}

async function sendTweet(tweet: NormalizedTweet): Promise<void> {
  console.log(`Sending tweet from @${tweet.username}: ${tweet.id}`);
  await discord.sendTweetEmbed(tweet);
  await discord.sendAdditionalImages(tweet);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

async function pollAll(): Promise<void> {
  pollCycleCount++;

  if (pollCycleCount % AUTH_CHECK_INTERVAL === 0) {
    const authOk = await twitter.checkAuth().catch(() => false);
    if (!authOk) {
      console.error("Auth health check failed — cookies may be expired");
      await discord.sendWarning(
        "Cookie authentication failed",
        "Periodic auth check failed. Cookies may be expired — re-export from Cookie-Editor.",
      ).catch((err) => console.error(`Failed to send auth warning: ${(err as Error).message}`));
    }
  }

  for (let i = 0; i < config.handles.length; i++) {
    try {
      await pollHandle(config.handles[i]);
    } catch (err) {
      console.error(`Error polling @${config.handles[i]}: ${(err as Error).message}`);
    }
    if (i < config.handles.length - 1) {
      await sleep(2000);
    }
  }
  console.log(`Poll cycle complete at ${new Date().toISOString()}`);
}

async function main(): Promise<void> {
  console.log("Starting Discord X Notifier...");

  await twitter.initialize(config.cookies);
  await discord.initialize(config.discordBotToken, config.discordChannelId);
  loadLastSeen(config.singleHandle);

  console.log(
    `Monitoring ${config.handles.length} handle(s): ${config.handles.map((h) => `@${h}`).join(", ")}`,
  );
  console.log(`Poll interval: ${config.pollIntervalMs / 1000}s`);

  // Stagger startup to avoid rate-limiting when multiple processes share cookies
  if (config.pollOffsetMs > 0) {
    console.log(`Waiting ${config.pollOffsetMs / 1000}s before first poll...`);
    await sleep(config.pollOffsetMs);
  }

  // Non-overlapping poll loop
  while (true) {
    await pollAll();
    await sleep(config.pollIntervalMs);
  }
}

// Graceful shutdown
function shutdown(): void {
  console.log("\nShutting down...");
  saveLastSeen();
  discord.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error(`Fatal error: ${(err as Error).message}`);
  process.exit(1);
});
