# Nitrado Discord Status Bot

A Discord bot that polls your Nitrado game server every 60 seconds and posts a message to a Discord channel whenever the server status changes (e.g. started, stopped, restarting).

---

## How It Works

```
Every 60s → Nitrado API → compare status → if changed → Discord channel message
```

Status values tracked: `started`, `stopped`, `stopping`, `restarting`, `suspended`

When status changes the bot posts a message like:

```
🟢 Server status changed: `stopped` → `started` | Players: 0/20
```

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
4. Under **Bot Permissions**, the bot only needs **Send Messages**
5. Go to **OAuth2** → **URL Generator** → check `bot` scope → check `Send Messages` permission
6. Open the generated URL in your browser and invite the bot to your Discord server

### 4. Discord Channel ID

1. In Discord: **User Settings** → **Advanced** → enable **Developer Mode**
2. Right-click the channel where you want status updates
3. Click **Copy Channel ID**

---

## Installation

### Windows

```bat
git clone https://github.com/jasonrundell/nitrado-discord-bot.git
cd nitrado-discord-bot
copy .env.example .env
```

Open `.env` in Notepad and fill in your four credentials, then:

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

Open `.env` in your editor and fill in your four credentials, then:

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
| `DISCORD_CHANNEL_ID` | Yes | Discord channel ID to post updates in |
| `POLL_INTERVAL_MS` | No | Polling interval in ms (default: `60000`) |

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
    types.ts              TypeScript interfaces for API responses
    __tests__/
      config.test.ts      Tests for config validation
      nitrado.test.ts     Tests for Nitrado API client
      discord.test.ts     Tests for message formatting and sending
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
- Never share your Nitrado or Discord tokens publicly
- The bot only requests the minimum Discord permission: **Send Messages**
