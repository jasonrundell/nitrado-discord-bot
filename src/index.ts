import 'dotenv/config';
import { config } from './config.js';
import { fetchServerStatus } from './nitrado.js';
import {
  createDiscordClient,
  loginAndGetChannel,
  sendStatusMessage,
} from './discord.js';
import type { ServerStatus } from './types.js';

async function main(): Promise<void> {
  console.log('Starting Nitrado Discord Status Bot...');

  const client = createDiscordClient();
  const channel = await loginAndGetChannel(
    client,
    config.discordToken,
    config.discordChannelId,
  );

  console.log(`Connected to Discord. Posting updates to: #${channel.name}`);
  console.log(
    `Monitoring Nitrado service ID: ${config.nitradoServiceId}`,
  );

  let lastStatus: ServerStatus | null = null;

  async function checkStatus(): Promise<void> {
    const snapshot = await fetchServerStatus(
      config.nitradoToken,
      config.nitradoServiceId,
    );

    console.log(
      `[${snapshot.checkedAt.toISOString()}] Status: ${snapshot.status}` +
        (snapshot.playerCurrent !== null
          ? ` | Players: ${snapshot.playerCurrent}/${snapshot.playerMax}`
          : ''),
    );

    if (snapshot.status !== lastStatus) {
      await sendStatusMessage(
        channel,
        lastStatus,
        snapshot.status,
        snapshot.playerCurrent,
        snapshot.playerMax,
      );
      lastStatus = snapshot.status;
    }
  }

  await checkStatus();

  setInterval(() => {
    checkStatus().catch((error: unknown) => {
      console.error('Polling error:', error);
    });
  }, config.pollIntervalMs);

  console.log(`Polling every ${config.pollIntervalMs / 1000}s. Bot is running.`);
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
