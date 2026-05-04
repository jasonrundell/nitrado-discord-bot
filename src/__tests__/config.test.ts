import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NITRADO_TOKEN', 'test-nitrado-token');
    vi.stubEnv('NITRADO_SERVICE_ID', '12345');
    vi.stubEnv('DISCORD_TOKEN', 'test-discord-token');
    vi.stubEnv('DISCORD_CHANNEL_ID', '67890');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads all required environment variables', async () => {
    vi.stubEnv('POLL_INTERVAL_MS', '30000');
    const { config } = await import('../config.js');
    expect(config.nitradoToken).toBe('test-nitrado-token');
    expect(config.nitradoServiceId).toBe('12345');
    expect(config.discordToken).toBe('test-discord-token');
    expect(config.discordChannelId).toBe('67890');
    expect(config.pollIntervalMs).toBe(30000);
  });

  it('uses default poll interval of 60000ms when POLL_INTERVAL_MS is not set', async () => {
    const { config } = await import('../config.js');
    expect(config.pollIntervalMs).toBe(60000);
  });

  it('throws when NITRADO_TOKEN is missing', async () => {
    vi.stubEnv('NITRADO_TOKEN', '');
    await expect(import('../config.js')).rejects.toThrow('NITRADO_TOKEN');
  });

  it('throws when NITRADO_SERVICE_ID is missing', async () => {
    vi.stubEnv('NITRADO_SERVICE_ID', '');
    await expect(import('../config.js')).rejects.toThrow('NITRADO_SERVICE_ID');
  });

  it('throws when DISCORD_TOKEN is missing', async () => {
    vi.stubEnv('DISCORD_TOKEN', '');
    await expect(import('../config.js')).rejects.toThrow('DISCORD_TOKEN');
  });

  it('throws when DISCORD_CHANNEL_ID is missing', async () => {
    vi.stubEnv('DISCORD_CHANNEL_ID', '');
    await expect(import('../config.js')).rejects.toThrow('DISCORD_CHANNEL_ID');
  });

  it('sets ftpLog to null when FTP_LOG_HOST is not set', async () => {
    const { config } = await import('../config.js');
    expect(config.ftpLog).toBeNull();
  });

  it('loads ftpLog when FTP_LOG_HOST and required FTP vars are set', async () => {
    vi.resetModules();
    vi.stubEnv('NITRADO_TOKEN', 'test-nitrado-token');
    vi.stubEnv('NITRADO_SERVICE_ID', '12345');
    vi.stubEnv('DISCORD_TOKEN', 'test-discord-token');
    vi.stubEnv('DISCORD_CHANNEL_ID', '67890');
    vi.stubEnv('FTP_LOG_HOST', 'ftp.example.com');
    vi.stubEnv('FTP_LOG_USER', 'nituser');
    vi.stubEnv('FTP_LOG_PASSWORD', 'secret');
    vi.stubEnv('FTP_LOG_REMOTE_PATH', 'games/12345/windrose/R5/Saved/Logs/R5.log');
    vi.stubEnv('FTP_LOG_TAIL_BYTES', '1048576');
    vi.stubEnv('FTP_LOG_COUNT_ONLY_SIGNATURE', 'false');

    const { config } = await import('../config.js');
    expect(config.ftpLog).not.toBeNull();
    expect(config.ftpLog?.host).toBe('ftp.example.com');
    expect(config.ftpLog?.remotePath).toBe('games/12345/windrose/R5/Saved/Logs/R5.log');
    expect(config.ftpLog?.tailBytes).toBe(1048576);
    expect(config.ftpLog?.signatureCountOnly).toBe(false);
  });

  it('throws when FTP_LOG_HOST is set but FTP_LOG_REMOTE_PATH is missing', async () => {
    vi.resetModules();
    vi.stubEnv('NITRADO_TOKEN', 'test-nitrado-token');
    vi.stubEnv('NITRADO_SERVICE_ID', '12345');
    vi.stubEnv('DISCORD_TOKEN', 'test-discord-token');
    vi.stubEnv('DISCORD_CHANNEL_ID', '67890');
    vi.stubEnv('FTP_LOG_HOST', 'ftp.example.com');
    vi.stubEnv('FTP_LOG_USER', 'u');
    vi.stubEnv('FTP_LOG_PASSWORD', 'p');
    vi.stubEnv('FTP_LOG_REMOTE_PATH', '');

    await expect(import('../config.js')).rejects.toThrow('FTP_LOG_REMOTE_PATH');
  });

  it('throws on invalid FTP_LOG_JOIN_REGEX', async () => {
    vi.resetModules();
    vi.stubEnv('NITRADO_TOKEN', 'test-nitrado-token');
    vi.stubEnv('NITRADO_SERVICE_ID', '12345');
    vi.stubEnv('DISCORD_TOKEN', 'test-discord-token');
    vi.stubEnv('DISCORD_CHANNEL_ID', '67890');
    vi.stubEnv('FTP_LOG_HOST', 'ftp.example.com');
    vi.stubEnv('FTP_LOG_USER', 'u');
    vi.stubEnv('FTP_LOG_PASSWORD', 'p');
    vi.stubEnv('FTP_LOG_REMOTE_PATH', '/log.txt');
    vi.stubEnv('FTP_LOG_JOIN_REGEX', '(');

    await expect(import('../config.js')).rejects.toThrow('FTP_LOG_JOIN_REGEX');
  });
});
