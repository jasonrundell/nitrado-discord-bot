import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import type { ServerStatus } from './types.js';

const STATUS_EMOJI: Record<ServerStatus, string> = {
  started: '🟢',
  stopped: '🔴',
  stopping: '🟠',
  restarting: '🟡',
  suspended: '⛔',
  unknown: '⚪',
};

export function createDiscordClient(): Client {
  return new Client({ intents: [GatewayIntentBits.Guilds] });
}

export async function loginAndGetChannel(
  client: Client,
  token: string,
  channelId: string,
): Promise<TextChannel> {
  await client.login(token);

  // #region agent log
  await new Promise<void>((resolve) => {
    if (client.isReady()) resolve();
    else client.once('ready', () => resolve());
  });
  const guildList = client.guilds.cache.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g.memberCount,
  }));
  const channelInGuild = client.guilds.cache.find((g) =>
    g.channels.cache.has(channelId),
  );
  fetch('http://127.0.0.1:7890/ingest/1ad506a3-b700-466f-840a-584e46a742ab', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '24a973',
    },
    body: JSON.stringify({
      sessionId: '24a973',
      hypothesisId: 'H1-H2-H4',
      location: 'discord.ts:loginAndGetChannel',
      message: 'bot guilds and target channel lookup',
      data: {
        botUser: client.user?.tag ?? null,
        botId: client.user?.id ?? null,
        guildCount: guildList.length,
        guilds: guildList,
        targetChannelId: channelId,
        targetChannelFoundInGuild: channelInGuild
          ? { id: channelInGuild.id, name: channelInGuild.name }
          : null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    const channel = await client.channels.fetch(channelId);

    // #region agent log
    fetch(
      'http://127.0.0.1:7890/ingest/1ad506a3-b700-466f-840a-584e46a742ab',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '24a973',
        },
        body: JSON.stringify({
          sessionId: '24a973',
          hypothesisId: 'H3-H5',
          location: 'discord.ts:loginAndGetChannel',
          message: 'channels.fetch result',
          data: {
            channelExists: channel !== null,
            channelType: channel?.type ?? null,
            channelName: 'name' in (channel ?? {}) ? (channel as { name: string }).name : null,
            isTextChannel: channel instanceof TextChannel,
          },
          timestamp: Date.now(),
        }),
      },
    ).catch(() => {});
    // #endregion

    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(
        `Channel ${channelId} not found or is not a text channel`,
      );
    }

    return channel;
  } catch (error: unknown) {
    // #region agent log
    const err = error as { code?: number; message?: string; status?: number };
    fetch(
      'http://127.0.0.1:7890/ingest/1ad506a3-b700-466f-840a-584e46a742ab',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '24a973',
        },
        body: JSON.stringify({
          sessionId: '24a973',
          hypothesisId: 'H3-H5',
          location: 'discord.ts:loginAndGetChannel',
          message: 'channels.fetch threw error',
          data: {
            errorCode: err.code,
            errorStatus: err.status,
            errorMessage: err.message,
          },
          timestamp: Date.now(),
        }),
      },
    ).catch(() => {});
    // #endregion
    throw error;
  }
}

export function formatStatusMessage(
  oldStatus: ServerStatus | null,
  newStatus: ServerStatus,
  playerCurrent: number | null,
  playerMax: number | null,
): string {
  const emoji = STATUS_EMOJI[newStatus] ?? '⚪';
  const timestamp = new Date().toUTCString();
  const playerInfo =
    playerCurrent !== null && playerMax !== null
      ? ` | Players: ${playerCurrent}/${playerMax}`
      : '';

  if (oldStatus === null) {
    return `${emoji} **Server status on startup:** \`${newStatus}\`${playerInfo}\n-# ${timestamp}`;
  }

  return `${emoji} **Server status changed:** \`${oldStatus}\` → \`${newStatus}\`${playerInfo}\n-# ${timestamp}`;
}

export async function sendStatusMessage(
  channel: TextChannel,
  oldStatus: ServerStatus | null,
  newStatus: ServerStatus,
  playerCurrent: number | null,
  playerMax: number | null,
): Promise<void> {
  const message = formatStatusMessage(
    oldStatus,
    newStatus,
    playerCurrent,
    playerMax,
  );
  await channel.send(message);
}
