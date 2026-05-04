import type { FtpLogConfig } from './types.js';
import {
  DEFAULT_LOG_JOIN_REGEXES,
  DEFAULT_LOG_LEAVE_REGEXES,
} from './ftpLogPlayers.js';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function compileUserRegex(envKey: string): RegExp | null {
  const raw = process.env[envKey]?.trim();
  if (!raw) return null;
  try {
    return new RegExp(raw);
  } catch {
    throw new Error(
      `Invalid JavaScript regular expression in ${envKey}. Check escaping (e.g. double backslashes in .env).`,
    );
  }
}

export function loadFtpLogConfig(): FtpLogConfig | null {
  const host = process.env['FTP_LOG_HOST']?.trim();
  if (!host) return null;

  const user = requireEnv('FTP_LOG_USER');
  const remotePath = requireEnv('FTP_LOG_REMOTE_PATH');
  const joinExtra = compileUserRegex('FTP_LOG_JOIN_REGEX');
  const leaveExtra = compileUserRegex('FTP_LOG_LEAVE_REGEX');

  return {
    host,
    port: parseInt(process.env['FTP_LOG_PORT'] ?? '21', 10),
    user,
    password: process.env['FTP_LOG_PASSWORD'] ?? '',
    remotePath,
    tailBytes: parseInt(process.env['FTP_LOG_TAIL_BYTES'] ?? '524288', 10),
    secure:
      process.env['FTP_LOG_SECURE'] === '1' ||
      process.env['FTP_LOG_SECURE']?.toLowerCase() === 'true',
    timeoutMs: parseInt(process.env['FTP_LOG_TIMEOUT_MS'] ?? '30000', 10),
    joinRegexes: [
      ...(joinExtra ? [joinExtra] : []),
      ...DEFAULT_LOG_JOIN_REGEXES,
    ],
    leaveRegexes: [
      ...(leaveExtra ? [leaveExtra] : []),
      ...DEFAULT_LOG_LEAVE_REGEXES,
    ],
    signatureCountOnly:
      process.env['FTP_LOG_COUNT_ONLY_SIGNATURE'] !== 'false',
  };
}

export const config = {
  nitradoToken: requireEnv('NITRADO_TOKEN'),
  nitradoServiceId: requireEnv('NITRADO_SERVICE_ID'),
  discordToken: requireEnv('DISCORD_TOKEN'),
  discordChannelId: requireEnv('DISCORD_CHANNEL_ID'),
  pollIntervalMs: parseInt(process.env['POLL_INTERVAL_MS'] ?? '60000', 10),
  ftpLog: loadFtpLogConfig(),
} as const;
