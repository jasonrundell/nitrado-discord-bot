import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlayerRosterSnapshot } from '../types.js';

const { mockReadFile } = vi.hoisted(() => ({ mockReadFile: vi.fn() }));

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}));

import {
  rosterFromNitrado,
  playerSignature,
  loadLegacyPlayerListMessageState,
} from '../playerList.js';

function makeRoster(
  overrides: Partial<PlayerRosterSnapshot> = {},
): PlayerRosterSnapshot {
  return {
    playerCurrent: 0,
    playerMax: 20,
    players: [],
    checkedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('rosterFromNitrado', () => {
  it('maps snapshot fields onto a roster', () => {
    const checkedAt = new Date('2026-02-01T00:00:00Z');
    const roster = rosterFromNitrado({
      status: 'started',
      playerCurrent: 4,
      playerMax: 12,
      players: ['P1'],
      checkedAt,
    });
    expect(roster).toEqual({
      playerCurrent: 4,
      playerMax: 12,
      players: ['P1'],
      checkedAt,
      rosterSource: 'nitrado',
    });
  });
});

describe('playerSignature', () => {
  it('produces a stable JSON string from player count and sorted names', () => {
    const snap = makeRoster({ playerCurrent: 3, players: ['Charlie', 'Alice', 'Bob'] });
    const sig = playerSignature(snap);
    expect(sig).toBe(JSON.stringify({ n: 3, names: ['Alice', 'Bob', 'Charlie'] }));
  });

  it('treats null players as an empty names array', () => {
    const snap = makeRoster({ playerCurrent: null, players: null });
    const sig = playerSignature(snap);
    expect(sig).toBe(JSON.stringify({ n: null, names: [] }));
  });

  it('returns the same signature for two rosters with identical sorted names', () => {
    const a = makeRoster({ playerCurrent: 2, players: ['X', 'Y'] });
    const b = makeRoster({ playerCurrent: 2, players: ['Y', 'X'] });
    expect(playerSignature(a)).toBe(playerSignature(b));
  });

  it('returns different signatures when count differs', () => {
    const a = makeRoster({ playerCurrent: 1, players: ['Alice'] });
    const b = makeRoster({ playerCurrent: 2, players: ['Alice'] });
    expect(playerSignature(a)).not.toBe(playerSignature(b));
  });

  it('returns different signatures when names differ', () => {
    const a = makeRoster({ playerCurrent: 1, players: ['Alice'] });
    const b = makeRoster({ playerCurrent: 1, players: ['Bob'] });
    expect(playerSignature(a)).not.toBe(playerSignature(b));
  });

  it('uses count-only signature when countOnly is true', () => {
    const a = makeRoster({ playerCurrent: 2, players: ['Alice', 'Bob'] });
    const b = makeRoster({ playerCurrent: 2, players: ['X', 'Y'] });
    expect(playerSignature(a, true)).toBe(playerSignature(b, true));
    expect(playerSignature(a, true)).toBe(JSON.stringify({ n: 2 }));
  });
});

describe('loadLegacyPlayerListMessageState', () => {
  beforeEach(() => {
    mockReadFile.mockReset();
  });

  it('returns parsed state when the file exists', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ messageId: 'abc123' }));
    const state = await loadLegacyPlayerListMessageState();
    expect(state).toEqual({ messageId: 'abc123' });
    expect(mockReadFile).toHaveBeenCalledWith(
      'data/player-list-message.json',
      'utf-8',
    );
  });

  it('returns null when the file does not exist', async () => {
    mockReadFile.mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );
    const state = await loadLegacyPlayerListMessageState();
    expect(state).toBeNull();
  });
});
