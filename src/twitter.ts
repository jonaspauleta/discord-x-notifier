import { Scraper, Tweet, Profile } from "@the-convocation/twitter-scraper";
import { CookieEditorEntry, NormalizedTweet, CachedProfile } from "./types";

const PROFILE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export class TwitterClient {
  private scraper = new Scraper();
  private profileCache = new Map<string, CachedProfile>();

  static formatCookies(entries: CookieEditorEntry[]): string[] {
    return entries.map((c) => {
      let str = `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path}`;
      if (c.secure) str += "; Secure";
      if (c.httpOnly) str += "; HttpOnly";
      if (c.sameSite) str += `; SameSite=${c.sameSite}`;
      return str;
    });
  }

  async initialize(cookies: CookieEditorEntry[]): Promise<void> {
    const cookieStrings = TwitterClient.formatCookies(cookies);
    await this.scraper.setCookies(cookieStrings);

    // Verify cookies were stored correctly
    const storedCookies = await this.scraper.getCookies();
    const cookieNames = new Set(storedCookies.map((c) => c.key));
    if (!cookieNames.has("auth_token") || !cookieNames.has("ct0")) {
      throw new Error(
        "Cookies were not stored correctly. Re-export from Cookie-Editor.",
      );
    }

    // Verify auth with a lightweight profile fetch
    try {
      await this.scraper.getProfile("x");
      console.log("Authenticated successfully via cookies");
    } catch (err) {
      console.error("Auth check failed:", (err as Error).message);
      throw new Error(
        "Failed to authenticate with X. Cookies may be expired — re-export from Cookie-Editor.",
      );
    }
  }

  async getProfile(handle: string): Promise<CachedProfile> {
    const cached = this.profileCache.get(handle);
    if (cached && Date.now() < cached.expiresAt) {
      return cached;
    }

    const profile: Profile = await this.scraper.getProfile(handle);
    const entry: CachedProfile = {
      avatarUrl: profile.avatar,
      name: profile.name,
      expiresAt: Date.now() + PROFILE_CACHE_TTL,
    };
    this.profileCache.set(handle, entry);
    return entry;
  }

  async fetchRecentTweets(handle: string, sinceId?: string): Promise<NormalizedTweet[]> {
    const profile = await this.getProfile(handle);
    const tweets: NormalizedTweet[] = [];

    const iterator = this.scraper.getTweets(handle, 20);
    for await (const tweet of iterator) {
      if (!tweet?.id) continue;
      if (tweet.isPin) continue;
      if (sinceId && BigInt(tweet.id) <= BigInt(sinceId)) continue;
      tweets.push(this.normalizeTweet(tweet, handle, profile));
    }

    // Return oldest first so Discord messages are in chronological order
    tweets.reverse();
    return tweets;
  }

  private normalizeTweet(
    tweet: Tweet,
    handle: string,
    profile: CachedProfile,
  ): NormalizedTweet {
    const isRetweet = tweet.isRetweet === true;
    const actualTweet = isRetweet && tweet.retweetedStatus ? tweet.retweetedStatus : tweet;

    return {
      id: tweet.id!,
      text: actualTweet.text || "",
      username: actualTweet.username || handle,
      name: actualTweet.name || profile.name || handle,
      avatarUrl: profile.avatarUrl,
      permanentUrl: tweet.permanentUrl || `https://x.com/${handle}/status/${tweet.id}`,
      photos: (actualTweet.photos || []).map((p) => ({ url: p.url })),
      videos: (actualTweet.videos || []).map((v) => ({
        preview: v.preview,
        url: v.url,
      })),
      likes: actualTweet.likes || 0,
      retweets: actualTweet.retweets || 0,
      replies: actualTweet.replies || 0,
      views: actualTweet.views || 0,
      isRetweet,
      isReply: tweet.isReply === true,
      quotedTweetUrl: tweet.quotedStatusId
        ? `https://x.com/i/status/${tweet.quotedStatusId}`
        : undefined,
      retweetedByUsername: isRetweet ? handle : undefined,
      timestamp: tweet.timeParsed || new Date(tweet.timestamp ? tweet.timestamp * 1000 : Date.now()),
    };
  }
}
