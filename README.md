# Nitrado Discord Status Bot

A Discord bot that polls your Nitrado game server on a fixed interval and maintains **one embed** in a Discord channel: **server status**, **player count**, and **players online** (from the gameserver query or, optionally, from an FTP log tail). The bot edits the same message on each change; the message ID is stored in `data/server-status-message.json`.

---

## How It Works

```
Every poll → Nitrado API (status + query when available)
         → optional FTP log tail for roster
         → if dashboard changed → edit single embed in #channel
```

Status values tracked: `started`, `stopped`, `stopping`, `restarting`, `suspended`

The bot posts **one embed** and keeps it up to date. On first run it sends the message; after restarts it edits the same message using `data/server-status-message.json`. If you previously used a separate players channel, delete the old embed there and remove any leftover `data/player-list-message.json` after upgrading (the bot logs a reminder if that file is still present).

---

## Prerequisites

Before running the bot you need four credentials. Follow the steps below to get them.

### 1. Nitrado Long-Life Token

1. Log in at [https://server.nitrado.net](https://server.nitrado.net)
2. Click your username (top right) → **My Account** → **Developer Portal** → **Long-Life Tokens**
3. Give the token a name (e.g. `discord-bot`) and check the **service** permission
4. Click **Create** and copy the token immediately — it will not be shown again

### 2. Nitrado Service ID

1. Go to **My Services** on the Nitrado dashboard
2. Click on your game server
3. The service ID is the number in the URL:
   `https://server.nitrado.net/en-US/my-services/gameservers/`**`19009097`**`/...`

### 3. Discord Bot Token

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application**, give it a name, click **Create**
3. Go to the **Bot** tab → click **Reset Token** → copy the token
4. Under **Bot Permissions**, invite the bot with **View Channel**, **Send Messages**, **Embed Links**, and **Read Message History** for the channel where the embed will live (see OAuth step below).

If anything is denied (especially via a category or channel permission override), Discord returns **Missing Access** (API code `50001`) when posting the embed — check this channel **and its parent category**.

5. Go to **OAuth2** → **URL Generator** → check `bot` scope → enable **View Channel**, **Send Messages**, **Embed Links**, and **Read Message History**
6. Open the generated URL in your browser and invite the bot to your Discord server

### 4. Discord channel ID (status + roster embed)

1. In Discord: **User Settings** → **Advanced** → enable **Developer Mode**
2. Right-click the channel where the embed should appear (e.g. `#server-status`)
3. In **Channel settings** → **Permissions**, for the bot’s role, explicitly allow **View Channel**, **Send Messages**, **Embed Links**, and **Read Message History** (check the parent **category** too)
4. Right-click the channel → **Copy Channel ID**

---

## Installation

### Windows

```bat
git clone https://github.com/jasonrundell/nitrado-discord-bot.git
cd nitrado-discord-bot
copy .env.example .env
```

Open `.env` in Notepad and fill in your credentials, then:

```bat
npm install
npm start
```

### macOS

```bash
git clone https://github.com/jasonrundell/nitrado-discord-bot.git
cd nitrado-discord-bot
cp .env.example .env
```

Open `.env` in your editor and fill in your credentials, then:

```bash
npm install
npm start
```

### Linux

```bash
git clone https://github.com/jasonrundell/nitrado-discord-bot.git
cd nitrado-discord-bot
cp .env.example .env
nano .env   # or use your preferred editor
npm install
npm start
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NITRADO_TOKEN` | Yes | Nitrado long-life API token |
| `NITRADO_SERVICE_ID` | Yes | Your Nitrado game server service ID |
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DISCORD_CHANNEL_ID` | Yes | Discord channel ID for the single status + roster embed |
| `POLL_INTERVAL_MS` | No | Polling interval in ms (default: `60000`) — used for both Nitrado status polls and FTP log pulls when FTP is enabled |

### Optional: player list from Nitrado FTP (Windrose / empty `query`)

If your game never fills Nitrado’s `gameservers` **query** block (common on **Windrose**), you can drive the **roster section** of the same embed from a **tail of a remote log file** over **FTP** instead. Server status still uses the Nitrado API; when FTP is enabled, **player count in the embed follows the log roster**, and **max slots** (if known) still come from the Nitrado query when available.

| Variable | Required | Description |
|---|---|---|
| `FTP_LOG_HOST` | No | When set (with user + remote path below), enables FTP log parsing for the player list |
| `FTP_LOG_PORT` | No | FTP port (default: `21`) |
| `FTP_LOG_USER` | With FTP | FTP username from the Nitrado panel |
| `FTP_LOG_PASSWORD` | With FTP | FTP password (may be empty on some setups) |
| `FTP_LOG_REMOTE_PATH` | With FTP | Path to the log file on the FTP server (see below) |
| `FTP_LOG_TAIL_BYTES` | No | How many **last bytes** of the file to download each poll (default: `524288` = 512 KiB). Increase if players who joined long ago disappear from the list |
| `FTP_LOG_SECURE` | No | Set to `true` or `1` for FTPS (TLS) |
| `FTP_LOG_TIMEOUT_MS` | No | FTP command timeout (default: `30000`) |
| `FTP_LOG_JOIN_REGEX` | No | Extra **join** line regex (first capture group = player name). Prepended to built-in UE-style patterns |
| `FTP_LOG_LEAVE_REGEX` | No | Extra **leave** line regex (first capture group = player name). Prepended to built-in patterns |
| `FTP_LOG_COUNT_ONLY_SIGNATURE` | No | When `true` (default), Discord edits only when **online count** changes (FTP roster); set to `false` to also edit when only names change at the same count |

**Finding `FTP_LOG_REMOTE_PATH` on Nitrado (Windows / macOS / Linux):**

1. Open [https://server.nitrado.net](https://server.nitrado.net) and select your **Windrose** service.
2. Open **FTP** or **File browser** (wording varies) and copy host, port, username, and password into `.env`.
3. Browse to **`windrose/R5/Saved/Logs/`** (relative to the game instance on the FTP server). Use **`R5.log`** only — that file is always the current log; older logs use other filenames.
4. Copy the **path relative to the FTP root** (as shown in the panel or your FTP client) into `FTP_LOG_REMOTE_PATH`, for example `games/<your-slot-id>/windrose/R5/Saved/Logs/R5.log` if Nitrado nests saves under `games/…`.

**Log parsing:** the bot downloads only the **end** of `R5.log` each `POLL_INTERVAL_MS`, then scans lines in order. Built-in behavior matches Windrose-style lines such as `LogNet: Join succeeded: DisplayName`, optional `ServerAccount. AccountName 'DisplayName'`, and **leave** rows listed under a **`Disconnected Accounts`** block (`1. Name 'DisplayName'. …`). Generic UE `LogNet` leave-style regexes are also checked. You can still prepend `FTP_LOG_JOIN_REGEX` / `FTP_LOG_LEAVE_REGEX` for custom lines. Wrong regexes produce wrong rosters; treat this as **best-effort** (see `samples/R5.log` in the repo).

---

## Running Tests

```bash
# Run tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Coverage targets: 70% lines, functions, branches, and statements.

---

## Project Structure

```
nitrado-discord-bot/
  src/
    index.ts              Entry point — starts the bot and polling loop
    config.ts             Loads and validates environment variables
    nitrado.ts            Nitrado API client — fetches server status
    discord.ts            Discord.js client — formats and sends messages
    playerList.ts         Roster helpers, change detection (`playerSignature`), legacy state read
    ftpLogPlayers.ts      Optional FTP tail download + log line parsing for player roster
    types.ts              TypeScript interfaces for API responses
    __tests__/
      config.test.ts      Tests for config validation
      nitrado.test.ts     Tests for Nitrado API client
      discord.test.ts     Tests for message formatting and sending
      playerList.test.ts  Tests for player-list logic
      ftpLogPlayers.test.ts  Tests for FTP log parsing helpers
  data/                   Runtime state (gitignored) — stores dashboard message ID (`server-status-message.json`)
  .env                    Your credentials (never commit this)
  .env.example            Template for .env
  vitest.config.ts        Test and coverage configuration
  tsconfig.json           TypeScript compiler configuration
  package.json
```

---

## Keeping the Bot Running (Optional)

By default the bot runs as a foreground process. To keep it running in the background on your machine:

### Windows — using pm2

```bat
npm install -g pm2
pm2 start "npm start" --name nitrado-bot
pm2 save
pm2 startup
```

### macOS / Linux — using pm2

```bash
npm install -g pm2
pm2 start "npm start" --name nitrado-bot
pm2 save
pm2 startup
```

---

## Security Notes

- The `.env` file is excluded from git via `.gitignore` — never commit it
- The `data/` directory (which stores the dashboard message ID) is also excluded from git
- Never share your Nitrado, Discord, or **FTP** credentials publicly
- The bot needs **View Channel**, **Send Messages**, **Embed Links**, and **Read Message History** in the target channel so it can post and edit the embed and resolve the stored message
