import {
  Client,
  Intents,
  MessageEmbed,
  TextChannel,
} from "discord.js";
import { NormalizedTweet } from "./types";

export class DiscordNotifier {
  private client = new Client({ intents: [Intents.FLAGS.GUILDS] });
  private channel: TextChannel | null = null;

  async initialize(token: string, channelId: string): Promise<void> {
    await this.client.login(token);

    if (!this.client.isReady()) {
      await new Promise<void>((resolve) => {
        this.client.on("ready", () => resolve());
      });
    }

    console.log(`Logged in as ${this.client.user?.tag}`);

    const ch = await this.client.channels.fetch(channelId);
    if (!ch || !(ch instanceof TextChannel)) {
      throw new Error(`Channel ${channelId} not found or is not a text channel`);
    }
    this.channel = ch;
  }

  async sendTweetEmbed(tweet: NormalizedTweet): Promise<void> {
    if (!this.channel) throw new Error("Discord not initialized");

    const embed = new MessageEmbed()
      .setColor(0x1da1f2)
      .setAuthor({
        name: `${tweet.name} (@${tweet.username})`,
        iconURL: tweet.avatarUrl,
        url: `https://x.com/${tweet.username}`,
      })
      .setDescription(tweet.text.slice(0, 4096))
      .setURL(tweet.permanentUrl)
      .setTimestamp(tweet.timestamp);

    // Title label for retweets/replies
    if (tweet.isRetweet && tweet.retweetedByUsername) {
      embed.setTitle(`Retweeted by @${tweet.retweetedByUsername}`);
    } else if (tweet.isReply) {
      embed.setTitle("Reply");
    }

    // First photo or video preview
    if (tweet.photos.length > 0) {
      embed.setImage(tweet.photos[0].url);
    } else if (tweet.videos.length > 0) {
      embed.setImage(tweet.videos[0].preview);
    }

    // Quoted tweet
    if (tweet.quotedTweetUrl) {
      embed.addFields({ name: "Quoted Tweet", value: tweet.quotedTweetUrl });
    }

    // Metrics footer
    const metrics = [
      `Likes: ${tweet.likes}`,
      `RTs: ${tweet.retweets}`,
      `Replies: ${tweet.replies}`,
      `Views: ${tweet.views}`,
    ].join(" | ");
    embed.setFooter({ text: metrics });

    await this.channel.send({ embeds: [embed] });
  }

  async sendAdditionalImages(tweet: NormalizedTweet): Promise<void> {
    if (!this.channel) throw new Error("Discord not initialized");
    if (tweet.photos.length <= 1) return;

    for (const photo of tweet.photos.slice(1)) {
      const embed = new MessageEmbed()
        .setURL(tweet.permanentUrl)
        .setImage(photo.url);
      await this.channel.send({ embeds: [embed] });
    }
  }

  destroy(): void {
    this.client.destroy();
  }
}
