import { Writable } from 'node:stream';
import { Client } from 'basic-ftp';
import type { FtpLogConfig, PlayerRosterSnapshot } from './types.js';

/**
 * Windrose / R5 dedicated log (`R5.log`) patterns from `samples/R5.log`, plus common UE lines.
 * `LogNet: Join succeeded: DisplayName` is the authoritative in-world join for Windrose.
 */
export const DEFAULT_LOG_JOIN_REGEXES: RegExp[] = [
  /ServerAccount\.\s*AccountName\s+'([^']+)'/i,
  /LogNet:\s*Join\s+succeeded:\s*(.+?)\s*$/i,
];

/**
 * Lines that remove a player from the inferred online set.
 * Windrose often lists leavers under a `Disconnected Accounts` block; see `parseRosterFromLogTail`.
 */
export const DEFAULT_LOG_LEAVE_REGEXES: RegExp[] = [
  /LogNet:.*\b(?:RemoveNetPlayer|removed)\b.*?:\s*(.+?)\s*$/i,
  /\b(?:Player|User)\s+["']?([^"'\s]{2,40})["']?\s+(?:has\s+)?disconnected\b/i,
];

/** Windrose data-keeper dump: numbered row under `Disconnected Accounts` with display name. */
const DISCONNECTED_ACCOUNT_NAME_LINE =
  /^\s*\d+\.\s*Name\s+'([^']+)'\./;

/** Start of a normal timestamped UE line (e.g. `[2026.05.02-14.42.34:357][613]LogNet:`). */
const UE_TIMESTAMP_LINE = /^\[\d{4}\./;

function isDisconnectedAccountsHeader(line: string): boolean {
  return line.trim() === 'Disconnected Accounts';
}

function shouldLeaveDisconnectedListingBlock(line: string): boolean {
  const t = line.trim();
  if (UE_TIMESTAMP_LINE.test(line)) return true;
  if (t === 'Connected Accounts') return true;
  return false;
}

export function sanitizePlayerName(raw: string): string {
  return raw
    .trim()
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^["']|["']$/g, '')
    .slice(0, 80);
}

/**
 * Replays join/leave regex matches in line order over a log tail.
 * Players who joined before this window may be missing until `FTP_LOG_TAIL_BYTES` is increased.
 */
export function parseRosterFromLogTail(
  logTail: string,
  joinRegexes: RegExp[],
  leaveRegexes: RegExp[],
): string[] {
  const online = new Set<string>();
  const lines = logTail.split(/\r?\n/);
  let inDisconnectedAccounts = false;
  let disconnectLinesSeen = 0;
  const maxDisconnectLines = 32;

  for (const line of lines) {
    if (inDisconnectedAccounts) {
      disconnectLinesSeen += 1;
      const dm = line.match(DISCONNECTED_ACCOUNT_NAME_LINE);
      if (dm?.[1]) {
        online.delete(sanitizePlayerName(dm[1]));
        continue;
      }
      if (
        shouldLeaveDisconnectedListingBlock(line) ||
        disconnectLinesSeen >= maxDisconnectLines
      ) {
        inDisconnectedAccounts = false;
        disconnectLinesSeen = 0;
      } else {
        continue;
      }
    }

    if (isDisconnectedAccountsHeader(line)) {
      inDisconnectedAccounts = true;
      disconnectLinesSeen = 0;
      continue;
    }

    let left = false;
    for (const re of leaveRegexes) {
      const m = line.match(re);
      if (m?.[1]) {
        online.delete(sanitizePlayerName(m[1]));
        left = true;
        break;
      }
    }
    if (left) continue;

    for (const re of joinRegexes) {
      const m = line.match(re);
      if (m?.[1]) {
        const name = sanitizePlayerName(m[1]);
        if (name.length > 0) online.add(name);
        break;
      }
    }
  }

  return [...online].sort((a, b) => a.localeCompare(b));
}

export function rosterFromFtpLogNames(
  names: string[],
  checkedAt: Date,
): PlayerRosterSnapshot {
  return {
    playerCurrent: names.length,
    playerMax: null,
    players: names,
    checkedAt,
    rosterSource: 'ftp_log',
  };
}

export async function fetchFtpLogTail(cfg: FtpLogConfig): Promise<string> {
  const client = new Client(cfg.timeoutMs);
  const chunks: Buffer[] = [];
  const collector = new Writable({
    write(chunk: string | Buffer, _enc, cb) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      cb();
    },
  });

  try {
    await client.access({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      secure: cfg.secure,
    });

    let size: number;
    try {
      size = await client.size(cfg.remotePath);
    } catch {
      throw new Error(
        `FTP: could not read size of remote file "${cfg.remotePath}". Check FTP_LOG_REMOTE_PATH.`,
      );
    }

    const startAt = Math.max(0, size - cfg.tailBytes);
    await client.downloadTo(collector, cfg.remotePath, startAt);
    return Buffer.concat(chunks).toString('utf-8');
  } finally {
    client.close();
  }
}
