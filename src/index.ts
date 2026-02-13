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
  console.log(`Polling @${handle}...`);
  const tweet = await twitter.fetchLatestTweet(handle);
  if (!tweet) {
    console.log(`No tweets found for @${handle}`);
    return;
  }

  const lastSeenId = getLastSeenId(handle);

  // First run: send the latest tweet and record ID
  if (!lastSeenId) {
    console.log(`First run for @${handle}, sending latest tweet: ${tweet.id}`);
    await sendTweet(tweet);
    setLastSeenId(handle, tweet.id);
    saveLastSeen();
    return;
  }

  // Only send if newer than last seen
  if (BigInt(tweet.id) <= BigInt(lastSeenId)) return;

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

async function pollAll(): Promise<void> {
  for (let i = 0; i < config.handles.length; i++) {
    try {
      await pollHandle(config.handles[i]);
    } catch (err) {
      console.error(
        `Error polling @${config.handles[i]}: ${(err as Error).message}`,
      );
    }
    // Small stagger between handles to avoid hammering X
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
  loadLastSeen();

  console.log(
    `Monitoring ${config.handles.length} handle(s): ${config.handles.map((h) => `@${h}`).join(", ")}`,
  );
  console.log(`Poll interval: ${config.pollIntervalMs / 1000}s`);

  // Initial poll
  await pollAll();

  // Continuous polling
  setInterval(() => {
    pollAll().catch((err) =>
      console.error(`Poll cycle error: ${(err as Error).message}`),
    );
  }, config.pollIntervalMs);
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
