import 'dotenv/config';
import { config } from './config.js';
import { fetchServerStatus } from './nitrado.js';
import {
  createDiscordClient,
  loginAndGetChannel,
  syncServerDashboardMessage,
  assertBotCanMaintainServerStatus,
} from './discord.js';
import {
  rosterFromNitrado,
  loadLegacyPlayerListMessageState,
} from './playerList.js';
import {
  fetchFtpLogTail,
  parseRosterFromLogTail,
  rosterFromFtpLogNames,
} from './ftpLogPlayers.js';
import type { PlayerRosterSnapshot } from './types.js';

async function main(): Promise<void> {
  console.log('Starting Nitrado Discord Status Bot...');

  const legacyPlayerListState = await loadLegacyPlayerListMessageState();
  if (legacyPlayerListState) {
    console.warn(
      '[legacy] data/player-list-message.json is still present (message ID: ' +
        `${legacyPlayerListState.messageId}). ` +
        'Delete the old player-list message in Discord (former players channel) if it remains, ' +
        'then remove this JSON file.',
    );
  }

  const client = createDiscordClient();
  const statusChannel = await loginAndGetChannel(
    client,
    config.discordToken,
    config.discordChannelId,
  );

  assertBotCanMaintainServerStatus(statusChannel, client.user);

  console.log(`Connected to Discord. Posting status and roster to: #${statusChannel.name}`);
  console.log(
    `Monitoring Nitrado service ID: ${config.nitradoServiceId}`,
  );
  if (config.ftpLog) {
    console.log(
      `Player list source: FTP log (${config.ftpLog.remotePath}, tail ${config.ftpLog.tailBytes} bytes, every ${config.pollIntervalMs / 1000}s)`,
    );
  } else {
    console.log('Player list source: Nitrado gameserver query');
  }

  let lastDashboardSignature: string | null = null;

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

    let roster: PlayerRosterSnapshot;
    if (config.ftpLog) {
      console.log(
        `[${new Date().toISOString()}] FTP: querying remote log "${config.ftpLog.remotePath}" (tail ${config.ftpLog.tailBytes} bytes)`,
      );
      const tail = await fetchFtpLogTail(config.ftpLog);
      const names = parseRosterFromLogTail(
        tail,
        config.ftpLog.joinRegexes,
        config.ftpLog.leaveRegexes,
      );
      roster = rosterFromFtpLogNames(names, new Date());
    } else {
      roster = rosterFromNitrado(snapshot);
    }

    lastDashboardSignature = await syncServerDashboardMessage(
      statusChannel,
      snapshot,
      roster,
      lastDashboardSignature,
      { signatureCountOnly: config.ftpLog?.signatureCountOnly ?? false },
    );
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
