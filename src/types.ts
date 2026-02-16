export interface CookieEditorEntry {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: string;
}

export interface AppConfig {
  discordBotToken: string;
  discordChannelId: string;
  discordGuildId: string;
  handles: string[];
  cookies: CookieEditorEntry[];
  pollIntervalMs: number;
  singleHandle?: string;
}

export type LastSeenMap = Record<string, string>;

export interface NormalizedTweet {
  id: string;
  text: string;
  username: string;
  name: string;
  avatarUrl?: string;
  permanentUrl: string;
  photos: { url: string }[];
  videos: { preview: string; url?: string }[];
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  isRetweet: boolean;
  isReply: boolean;
  quotedTweetUrl?: string;
  retweetedByUsername?: string;
  timestamp: Date;
}

export interface CachedProfile {
  avatarUrl?: string;
  name?: string;
  expiresAt: number;
}
