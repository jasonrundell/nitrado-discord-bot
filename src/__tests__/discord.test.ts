import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createDiscordClient,
  fetchTextChannel,
  loginAndGetChannel,
  assertBotCanMaintainServerStatus,
  serverStatusSignature,
  buildStatusDashboardEmbed,
  dashboardSignature,
  formatRosterNamesForEmbed,
  syncServerDashboardMessage,
} from '../discord.js';
import type { PlayerRosterSnapshot, ServerStatus } from '../types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { MockClient, mockReadFile, mockWriteFile, mockMkdir } = vi.hoisted(() => {
  const MockClient = vi.fn().mockReturnValue({ isMockClient: true });
  const mockReadFile = vi.fn();
  const mockWriteFile = vi.fn();
  const mockMkdir = vi.fn();
  return { MockClient, mockReadFile, mockWriteFile, mockMkdir };
});

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
}));

vi.mock('discord.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('discord.js')>();
  return {
    ...actual,
    Client: MockClient,
    TextChannel: class TextChannel {},
  };
});

function makeRoster(o: Partial<PlayerRosterSnapshot> = {}): PlayerRosterSnapshot {
  return {
    playerCurrent: 1,
    playerMax: 10,
    players: [],
    checkedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...o,
  };
}

describe('loginAndGetChannel', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true });
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockMkdir.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves and returns the channel when the client is already ready', async () => {
    const { TextChannel } = await import('discord.js');
    const mockChannel = new TextChannel();
    const mockClient = {
      login: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockReturnValue(true),
      once: vi.fn(),
      user: { tag: 'Bot#0001', id: 'bot-id' },
      guilds: {
        cache: {
          map: vi.fn().mockReturnValue([]),
          find: vi.fn().mockReturnValue(null),
        },
      },
      channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
    } as never;

    const result = await loginAndGetChannel(mockClient, 'token', 'chan1');
    expect(result).toBe(mockChannel);
  });

  it('waits for the ready event when the client is not yet ready', async () => {
    const { TextChannel } = await import('discord.js');
    const mockChannel = new TextChannel();
    let readyCb: (() => void) | null = null;

    const mockClient = {
      login: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockReturnValue(false),
      once: vi.fn((_event: string, cb: () => void) => {
        readyCb = cb;
      }),
      user: null,
      guilds: {
        cache: {
          map: vi.fn().mockReturnValue([]),
          find: vi.fn().mockReturnValue(null),
        },
      },
      channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
    } as never;

    const promise = loginAndGetChannel(mockClient, 'token', 'chan2');
    await Promise.resolve();
    await Promise.resolve();
    readyCb!();
    const result = await promise;
    expect(result).toBe(mockChannel);
  });

  it('throws and rethrows errors from channels.fetch', async () => {
    const fetchError = new Error('Unknown Channel');
    const mockClient = {
      login: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockReturnValue(true),
      once: vi.fn(),
      user: null,
      guilds: {
        cache: {
          map: vi.fn().mockReturnValue([]),
          find: vi.fn().mockReturnValue(null),
        },
      },
      channels: { fetch: vi.fn().mockRejectedValue(fetchError) },
    } as never;

    await expect(loginAndGetChannel(mockClient, 'token', 'bad')).rejects.toThrow(
      'Unknown Channel',
    );
  });

  it('throws when channels.fetch returns null', async () => {
    const mockClient = {
      login: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockReturnValue(true),
      once: vi.fn(),
      user: null,
      guilds: {
        cache: {
          map: vi.fn().mockReturnValue([]),
          find: vi.fn().mockReturnValue(null),
        },
      },
      channels: { fetch: vi.fn().mockResolvedValue(null) },
    } as never;

    await expect(loginAndGetChannel(mockClient, 'token', 'nullchan')).rejects.toThrow(
      'nullchan',
    );
  });
});

describe('assertBotCanMaintainServerStatus', () => {
  it('does nothing when the bot has all required permissions', () => {
    const mockChannel = {
      name: 'status',
      permissionsFor: vi.fn().mockReturnValue({
        has: vi.fn().mockReturnValue(true),
      }),
    } as never;
    assertBotCanMaintainServerStatus(mockChannel, { id: 'bot' } as never);
  });

  it('throws when botUser is null', () => {
    const mockChannel = { name: 'status' } as never;
    expect(() => assertBotCanMaintainServerStatus(mockChannel, null)).toThrow(
      'bot user is not available',
    );
  });

  it('throws when permissions cannot be resolved', () => {
    const mockChannel = {
      name: 'status',
      permissionsFor: vi.fn().mockReturnValue(null),
    } as never;
    expect(() =>
      assertBotCanMaintainServerStatus(mockChannel, { id: 'bot' } as never),
    ).toThrow('Cannot resolve permissions');
  });

  it('throws listing missing Discord permissions when the bot lacks bits', () => {
    const mockChannel = {
      name: 'server-status',
      permissionsFor: vi.fn().mockReturnValue({
        has: vi.fn().mockReturnValue(false),
      }),
    } as never;
    expect(() =>
      assertBotCanMaintainServerStatus(mockChannel, { id: 'bot' } as never),
    ).toThrow(/Missing permission/);
    expect(() =>
      assertBotCanMaintainServerStatus(mockChannel, { id: 'bot' } as never),
    ).toThrow(/50001/);
  });
});

describe('createDiscordClient', () => {
  it('returns a Discord client instance', () => {
    const client = createDiscordClient();
    expect(MockClient).toHaveBeenCalledOnce();
    expect(client).toBeDefined();
  });
});

describe('fetchTextChannel', () => {
  it('returns the channel when it is a TextChannel instance', async () => {
    const { TextChannel } = await import('discord.js');
    const mockChannel = new TextChannel();
    const mockClient = {
      channels: { fetch: vi.fn().mockResolvedValueOnce(mockChannel) },
    } as never;

    const result = await fetchTextChannel(mockClient, 'chan123');
    expect(result).toBe(mockChannel);
  });

  it('throws when the channel is not found (null)', async () => {
    const mockClient = {
      channels: { fetch: vi.fn().mockResolvedValueOnce(null) },
    } as never;

    await expect(fetchTextChannel(mockClient, 'missing')).rejects.toThrow(
      'missing',
    );
  });

  it('throws when the channel exists but is not a TextChannel', async () => {
    const mockClient = {
      channels: { fetch: vi.fn().mockResolvedValueOnce({ type: 2 }) },
    } as never;

    await expect(fetchTextChannel(mockClient, 'voice123')).rejects.toThrow(
      'voice123',
    );
  });
});

describe('serverStatusSignature', () => {
  it('changes when status or player counts change', () => {
    const a = serverStatusSignature({
      status: 'started',
      playerCurrent: 1,
      playerMax: 10,
      players: [],
      checkedAt: new Date('2020-01-01'),
    });
    const b = serverStatusSignature({
      status: 'stopped',
      playerCurrent: 1,
      playerMax: 10,
      players: [],
      checkedAt: new Date('2020-01-01'),
    });
    expect(a).not.toBe(b);
  });
});

describe('dashboardSignature', () => {
  const snapshot = {
    status: 'started' as const,
    playerCurrent: 2,
    playerMax: 20,
    players: ['Z', 'A'] as string[] | null,
    checkedAt: new Date('2024-06-01T12:00:00.000Z'),
  };

  it('includes roster names unless signatureCountOnly', () => {
    const roster = makeRoster({
      playerCurrent: 2,
      players: ['Z', 'A'],
      checkedAt: snapshot.checkedAt,
    });
    const full = dashboardSignature(snapshot, roster, { signatureCountOnly: false });
    const countOnly = dashboardSignature(snapshot, roster, { signatureCountOnly: true });
    expect(full).not.toBe(countOnly);
    expect(countOnly).toBe(
      dashboardSignature(snapshot, makeRoster({ playerCurrent: 2, players: ['B', 'C'] }), {
        signatureCountOnly: true,
      }),
    );
  });
});

describe('formatRosterNamesForEmbed', () => {
  it('appends truncation suffix when names do not fit the budget', () => {
    const names = Array.from({ length: 30 }, (_, i) => `Player${i}`);
    const text = formatRosterNamesForEmbed(names, 120);
    expect(text).toMatch(/truncated/);
    expect(text.length).toBeLessThanOrEqual(120);
  });
});

describe('buildStatusDashboardEmbed', () => {
  it('includes status and player fields for Nitrado roster', () => {
    const snap = {
      status: 'started' as const,
      playerCurrent: 3,
      playerMax: 20,
      players: ['a'],
      checkedAt: new Date('2024-06-01T12:00:00.000Z'),
    };
    const roster = makeRoster({
      playerCurrent: 3,
      playerMax: 20,
      players: ['Alice', 'Bob'],
      rosterSource: 'nitrado',
      checkedAt: snap.checkedAt,
    });

    const embed = buildStatusDashboardEmbed(snap, roster);
    const json = embed.toJSON();
    expect(json.title).toBe('Server status');
    expect(json.description).toContain('started');
    expect(json.description).toContain('🟢');
    const countField = json.fields?.find((f) => f.name === 'Player count');
    expect(countField?.value).toBe('3 / 20');
    const onlineField = json.fields?.find((f) => f.name === 'Players online');
    expect(onlineField?.value).toContain('• Alice');
    expect(onlineField?.value).toContain('• Bob');
    expect(json.footer).toBeUndefined();
  });

  it('uses snapshot max with FTP roster count for player count field', () => {
    const snap = {
      status: 'started' as const,
      playerCurrent: 9,
      playerMax: 20,
      players: null,
      checkedAt: new Date('2024-06-01T12:00:00.000Z'),
    };
    const roster = makeRoster({
      playerCurrent: 2,
      playerMax: null,
      players: ['X', 'Y'],
      rosterSource: 'ftp_log',
      checkedAt: snap.checkedAt,
    });
    const embed = buildStatusDashboardEmbed(snap, roster);
    const json = embed.toJSON();
    const countField = json.fields?.find((f) => f.name === 'Player count');
    expect(countField?.value).toBe('2 / 20');
    expect(json.footer?.text).toMatch(/FTP/);
  });

  it('shows Unavailable when roster query is down', () => {
    const snap = {
      status: 'unknown' as const,
      playerCurrent: null,
      playerMax: null,
      players: null,
      checkedAt: new Date(),
    };
    const roster = makeRoster({
      playerCurrent: null,
      playerMax: null,
      players: null,
      checkedAt: snap.checkedAt,
    });
    const json = buildStatusDashboardEmbed(snap, roster).toJSON();
    const countField = json.fields?.find((f) => f.name === 'Player count');
    expect(countField?.value).toBe('Unavailable');
  });

  it('uses correct emoji for each status', () => {
    const cases: Array<[ServerStatus, string]> = [
      ['started', '🟢'],
      ['stopped', '🔴'],
      ['stopping', '🟠'],
      ['restarting', '🟡'],
      ['suspended', '⛔'],
      ['unknown', '⚪'],
    ];

    for (const [status, emoji] of cases) {
      const embed = buildStatusDashboardEmbed(
        {
          status,
          playerCurrent: null,
          playerMax: null,
          players: null,
          checkedAt: new Date(),
        },
        makeRoster({ playerCurrent: null, players: null }),
      );
      expect(embed.toJSON().description).toContain(emoji);
    }
  });
});

describe('syncServerDashboardMessage', () => {
  beforeEach(() => {
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockMkdir.mockReset();
  });

  function makeSnapshot(overrides?: Partial<{
    status: ServerStatus;
    playerCurrent: number | null;
    playerMax: number | null;
  }>) {
    return {
      status: 'started' as const,
      playerCurrent: 1,
      playerMax: 10,
      players: [] as string[] | null,
      checkedAt: new Date('2024-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('returns last signature without calling Discord when unchanged', async () => {
    const snapshot = makeSnapshot();
    const roster = makeRoster({ playerCurrent: 1, players: [] });
    const sig = dashboardSignature(snapshot, roster, {});
    const mockSend = vi.fn();
    const mockChannel = { send: mockSend, messages: { fetch: vi.fn() } } as never;

    const out = await syncServerDashboardMessage(mockChannel, snapshot, roster, sig, {});

    expect(out).toBe(sig);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends a new message and saves state when no persisted state exists', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const mockSend = vi.fn().mockResolvedValue({ id: 'msg-new' });
    const mockChannel = { send: mockSend, messages: { fetch: vi.fn() } } as never;

    const snapshot = makeSnapshot();
    const roster = makeRoster({ playerCurrent: 0, players: [] });

    const sig = await syncServerDashboardMessage(mockChannel, snapshot, roster, null, {});

    expect(sig).toBe(dashboardSignature(snapshot, roster, {}));
    expect(mockSend).toHaveBeenCalledOnce();
    const [payload] = mockSend.mock.calls[0] as [{ embeds: unknown[] }];
    expect(payload.embeds).toHaveLength(1);
    expect(mockWriteFile).toHaveBeenCalled();
    const writtenPath = String(mockWriteFile.mock.calls[0][0]);
    expect(writtenPath).toMatch(/server-status-message\.json/);
  });

  it('edits the existing message when state file is valid', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ messageId: 'msg-1' }));
    const mockEdit = vi.fn().mockResolvedValue(undefined);
    const mockFetchMsg = vi.fn().mockResolvedValue({ edit: mockEdit });
    const mockSend = vi.fn();
    const mockChannel = {
      send: mockSend,
      messages: { fetch: mockFetchMsg },
    } as never;

    const roster = makeRoster({ playerCurrent: 1, players: ['A'] });
    await syncServerDashboardMessage(
      mockChannel,
      makeSnapshot({ playerCurrent: 2 }),
      roster,
      null,
      {},
    );

    expect(mockFetchMsg).toHaveBeenCalledWith('msg-1');
    expect(mockEdit).toHaveBeenCalledOnce();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('posts a new message when the stored message cannot be fetched', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ messageId: 'gone' }));
    const mockFetchMsg = vi.fn().mockRejectedValue(new Error('Unknown Message'));
    const mockSend = vi.fn().mockResolvedValue({ id: 'msg-replace' });
    const mockChannel = {
      send: mockSend,
      messages: { fetch: mockFetchMsg },
    } as never;

    const snapshot = makeSnapshot();
    const roster = makeRoster({ playerCurrent: 0, players: [] });
    await syncServerDashboardMessage(mockChannel, snapshot, roster, null, {});

    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockWriteFile).toHaveBeenCalled();
  });
});
