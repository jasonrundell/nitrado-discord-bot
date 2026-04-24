function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  nitradoToken: requireEnv('NITRADO_TOKEN'),
  nitradoServiceId: requireEnv('NITRADO_SERVICE_ID'),
  discordToken: requireEnv('DISCORD_TOKEN'),
  discordChannelId: requireEnv('DISCORD_CHANNEL_ID'),
  pollIntervalMs: parseInt(process.env['POLL_INTERVAL_MS'] ?? '60000', 10),
} as const;
