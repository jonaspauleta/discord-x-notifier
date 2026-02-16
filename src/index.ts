import { loadConfig } from "./config";
import {
  loadLastSeen,
  saveLastSeen,
  getLastSeenId,
  setLastSeenId,
} from "./state";
import { TwitterClient } from "./twitter";
import { DiscordNotifier } from "./discord";
import { NormalizedTweet } from "./types";

const config = loadConfig();
const twitter = new TwitterClient();
const discord = new DiscordNotifier();

async function pollHandle(handle: string): Promise<void> {
  const lastSeenId = getLastSeenId(handle);

  const tweets = await withTimeout(
    twitter.fetchRecentTweets(handle, lastSeenId),
    30000,
  ).catch((err) => {
    console.error(`Failed to fetch @${handle}: ${(err as Error).message}`);
    return [];
  });

  if (tweets.length === 0) return;

  // First run: only send the latest tweet to avoid spamming backlog
  const toSend = lastSeenId ? tweets : [tweets[tweets.length - 1]];

  console.log(`Fetched ${tweets.length} tweet(s) for @${handle}, sending ${toSend.length}`);

  for (const tweet of toSend) {
    await sendTweet(tweet);
    setLastSeenId(handle, tweet.id);
  }
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
  console.log("Poll cycle complete");
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
