# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discord bot that monitors X (Twitter) accounts and posts rich embeds to a Discord channel when new tweets are detected. Uses cookie-based authentication with `@the-convocation/twitter-scraper` (not the official Twitter API) and `discord.js` v13.

## Commands

```bash
pnpm install          # Install dependencies
pnpm run dev          # Run with tsx (hot-reload, development)
pnpm run build        # Compile TypeScript to dist/
pnpm run start        # Run compiled JS from dist/
```

Production deployment uses PM2 via `ecosystem.config.cjs`.

## Architecture

The app is a single long-running process with a polling loop. No HTTP server, no database.

**Poll cycle flow:** `main()` → `setInterval(pollAll)` → `pollHandle(handle)` per handle (sequential, 2s delay between) → fetch latest tweet → compare against last-seen ID (BigInt comparison) → send Discord embed if new.

### Source Files (`src/`)

- **index.ts** — Entry point. Orchestrates the poll loop, timeout wrapper, graceful shutdown (SIGINT/SIGTERM saves state).
- **config.ts** — Loads `.env` vars and JSON config files (`handles.json`, `cookies.json`). Validates required env vars and cookie presence (`auth_token`, `ct0`).
- **twitter.ts** — `TwitterClient` class. Wraps the scraper library. Caches profiles (30min TTL). Normalizes raw `Tweet` objects into `NormalizedTweet`. Uses `getLatestTweet(handle, true, 1)` fast path.
- **discord.ts** — `DiscordNotifier` class. Sends tweet embeds with author info, metrics footer, media. Sends additional photos as separate embeds linked by URL.
- **state.ts** — Reads/writes `last-seen.json` (maps handle → last tweet ID string). Module-level mutable state.
- **types.ts** — Shared interfaces: `AppConfig`, `NormalizedTweet`, `CookieEditorEntry`, `CachedProfile`, `LastSeenMap`.

### Runtime Files (project root, gitignored)

- **cookies.json** — X session cookies exported from Cookie-Editor browser extension. Must contain `auth_token` and `ct0`.
- **handles.json** — Array of X handles to monitor (without `@` prefix). See `handles.example.json`.
- **last-seen.json** — Persisted state tracking last-seen tweet ID per handle. Auto-managed.
- **.env** — Discord bot token, channel ID, guild ID, poll interval. See `.env.example`.

## Key Patterns

- **No tests or linter configured** — there are no test scripts or lint configs.
- **CommonJS output** — `tsconfig.json` targets `module: "commonjs"`, compiled to `dist/`.
- **Tweet ID comparison uses BigInt** — IDs are stored as strings but compared as `BigInt` to handle Twitter's large snowflake IDs.
- **Retweets resolve to original tweet** — `normalizeTweet` unwraps `retweetedStatus` for content but keeps the original tweet's ID for dedup.
- **discord.js v13 API** — Uses `MessageEmbed` (not `EmbedBuilder`), `Intents.FLAGS.GUILDS`, `addFields()` (not `addField()`).
