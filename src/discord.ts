import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import type {
  PlayerRosterSnapshot,
  ServerStatus,
  ServerStatusSnapshot,
} from './types.js';
import type { User } from 'discord.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { playerSignature } from './playerList.js';

const EMBED_MESSAGE_PERM_BITS = [
  { flag: PermissionFlagsBits.ViewChannel, label: 'View Channel' },
  { flag: PermissionFlagsBits.SendMessages, label: 'Send Messages' },
  { flag: PermissionFlagsBits.EmbedLinks, label: 'Embed Links' },
  { flag: PermissionFlagsBits.ReadMessageHistory, label: 'Read Message History' },
] as const;

const SERVER_STATUS_STATE_PATH = join('data', 'server-status-message.json');

/** Leave room under Discord’s 1024-char field cap for the truncation suffix. */
const ROSTER_NAMES_FIELD_BUDGET = 980;

interface ServerStatusMessageState {
  messageId: string;
}

function assertBotCanEditEmbedMessage(
  channel: TextChannel,
  botUser: User | null,
  notReadyMessage: string,
  missingPermsSuffix: string,
): void {
  if (!botUser) {
    throw new Error(notReadyMessage);
  }

  const perms = channel.permissionsFor(botUser);
  if (!perms) {
    throw new Error(
      `Cannot resolve permissions for channel #${channel.name}. Check that the bot is in this server and that its role has access to this channel.`,
    );
  }

  const bits = EMBED_MESSAGE_PERM_BITS.map((p) => p.flag);
  if (!perms.has(bits)) {
    const missingNames = EMBED_MESSAGE_PERM_BITS.filter(
      ({ flag }) => !perms.has(flag),
    )
      .map(({ label }) => label)
      .join(', ');

    throw new Error(
      `Discord channel (#${channel.name}): Missing permission(s): ${missingNames}. ` +
        `In Server Settings → Integrations → your bot → (or Roles), allow these on this channel **and its category** — channel overrides usually deny inherited permissions. ` +
        missingPermsSuffix,
    );
  }
}

export function assertBotCanMaintainServerStatus(
  channel: TextChannel,
  botUser: User | null,
): void {
  assertBotCanEditEmbedMessage(
    channel,
    botUser,
    'Cannot verify Discord channel permissions: bot user is not available yet.',
    'The bot posts server status and player roster embeds, so Embed Links must be enabled. API error 50001 (Missing Access) usually means View Channel / Send Messages / Embed Links / Read Message History is blocked.',
  );
}

const STATUS_EMOJI: Record<ServerStatus, string> = {
  started: '🟢',
  stopped: '🔴',
  stopping: '🟠',
  restarting: '🟡',
  suspended: '⛔',
  unknown: '⚪',
};

const STATUS_EMBED_COLOR: Record<ServerStatus, number> = {
  started: 0x22_c5_5e,
  stopped: 0xed_42_45,
  stopping: 0xf9_73_16,
  restarting: 0xea_b3_08,
  suspended: 0x6b_72_80,
  unknown: 0x94_a3_b8,
};

export function serverStatusSignature(snapshot: ServerStatusSnapshot): string {
  return JSON.stringify({
    status: snapshot.status,
    playerCurrent: snapshot.playerCurrent,
    playerMax: snapshot.playerMax,
  });
}

export function dashboardSignature(
  snapshot: ServerStatusSnapshot,
  roster: PlayerRosterSnapshot,
  options?: { signatureCountOnly?: boolean },
): string {
  return JSON.stringify([
    serverStatusSignature(snapshot),
    playerSignature(roster, options?.signatureCountOnly),
  ]);
}

function suffixTruncated(omitted: number): string {
  return omitted > 0 ? `\n… and ${omitted} more (truncated)` : '';
}

export function formatRosterNamesForEmbed(names: string[], maxChars: number): string {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  const lines = sorted.map((n) => `• ${n}`);
  if (lines.length === 0) {
    return '';
  }

  let chunk = '';
  let included = 0;
  for (let i = 0; i < lines.length; i++) {
    const next = i === 0 ? lines[i]! : `${chunk}\n${lines[i]!}`;
    const omitted = lines.length - i - 1;
    if (next.length + suffixTruncated(omitted).length <= maxChars) {
      chunk = next;
      included = i + 1;
    } else {
      break;
    }
  }

  if (included === 0) {
    const omitted = lines.length - 1;
    const headBudget = Math.max(4, maxChars - suffixTruncated(omitted).length - 1);
    const first = lines[0]!;
    const head =
      first.length <= headBudget ? first : `${first.slice(0, headBudget - 1)}…`;
    return head + suffixTruncated(omitted);
  }

  return chunk + suffixTruncated(lines.length - included);
}

function playerCountFieldValue(
  snapshot: ServerStatusSnapshot,
  roster: PlayerRosterSnapshot,
): string {
  if (roster.playerCurrent === null) {
    return 'Unavailable';
  }

  const maxForDisplay =
    roster.rosterSource === 'ftp_log' ? snapshot.playerMax : roster.playerMax;

  if (maxForDisplay !== null) {
    return `${roster.playerCurrent} / ${maxForDisplay}`;
  }
  return String(roster.playerCurrent);
}

function rosterOnlineFieldBody(
  roster: PlayerRosterSnapshot,
  maxChars: number,
): string {
  const playerCount = roster.playerCurrent ?? 0;
  const players = roster.players;

  if (roster.playerCurrent === null) {
    return 'Server query unavailable.';
  }
  if (playerCount === 0) {
    return roster.rosterSource === 'ftp_log'
      ? 'No players matched in the current log tail (or log window too small).'
      : 'No players online.';
  }
  if (!players || players.length === 0) {
    return `${playerCount} player${playerCount !== 1 ? 's' : ''} online.\n*(Names unavailable)*`;
  }
  return formatRosterNamesForEmbed(players, maxChars);
}

export function buildStatusDashboardEmbed(
  snapshot: ServerStatusSnapshot,
  roster: PlayerRosterSnapshot,
): EmbedBuilder {
  const emoji = STATUS_EMOJI[snapshot.status] ?? '⚪';
  const color = STATUS_EMBED_COLOR[snapshot.status] ?? STATUS_EMBED_COLOR.unknown;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('Server status')
    .setDescription(`${emoji} **\`${snapshot.status}\`**`)
    .addFields(
      {
        name: 'Player count',
        value: playerCountFieldValue(snapshot, roster),
        inline: true,
      },
      {
        name: 'Players online',
        value: rosterOnlineFieldBody(roster, ROSTER_NAMES_FIELD_BUDGET),
        inline: false,
      },
    )
    .setTimestamp(snapshot.checkedAt);

  if (roster.rosterSource === 'ftp_log') {
    embed.setFooter({
      text:
        'Roster from FTP log tail; max slots (when shown) from Nitrado query. ' +
        'Adjust FTP_LOG_JOIN_REGEX / FTP_LOG_LEAVE_REGEX / FTP_LOG_TAIL_BYTES if needed.',
    });
  }

  return embed;
}

async function loadServerStatusMessageState(): Promise<ServerStatusMessageState | null> {
  try {
    const raw = await readFile(SERVER_STATUS_STATE_PATH, 'utf-8');
    return JSON.parse(raw) as ServerStatusMessageState;
  } catch {
    return null;
  }
}

async function saveServerStatusMessageState(
  state: ServerStatusMessageState,
): Promise<void> {
  await mkdir('data', { recursive: true });
  await writeFile(
    SERVER_STATUS_STATE_PATH,
    JSON.stringify(state, null, 2),
    'utf-8',
  );
}

export async function syncServerDashboardMessage(
  channel: TextChannel,
  snapshot: ServerStatusSnapshot,
  roster: PlayerRosterSnapshot,
  lastSignature: string | null,
  options?: { signatureCountOnly?: boolean },
): Promise<string> {
  const sig = dashboardSignature(snapshot, roster, options);

  if (sig === lastSignature) return sig;

  const embed = buildStatusDashboardEmbed(snapshot, roster);
  const state = await loadServerStatusMessageState();

  if (state) {
    try {
      const existing = await channel.messages.fetch(state.messageId);
      await existing.edit({ embeds: [embed] });
      return sig;
    } catch {
      // Message was deleted or inaccessible — fall through to post a new one
    }
  }

  const newMessage = await channel.send({ embeds: [embed] });
  await saveServerStatusMessageState({ messageId: newMessage.id });
  return sig;
}

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

export async function fetchTextChannel(
  client: Client,
  channelId: string,
): Promise<TextChannel> {
  const channel = await client.channels.fetch(channelId);

  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error(`Channel ${channelId} not found or is not a text channel`);
  }

  return channel;
}
