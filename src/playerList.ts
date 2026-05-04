import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlayerRosterSnapshot, ServerStatusSnapshot } from './types.js';

const LEGACY_PLAYER_LIST_STATE_PATH = join('data', 'player-list-message.json');

export function rosterFromNitrado(
  snapshot: ServerStatusSnapshot,
): PlayerRosterSnapshot {
  return {
    playerCurrent: snapshot.playerCurrent,
    playerMax: snapshot.playerMax,
    players: snapshot.players,
    checkedAt: snapshot.checkedAt,
    rosterSource: 'nitrado',
  };
}

export function playerSignature(
  roster: PlayerRosterSnapshot,
  countOnly?: boolean,
): string {
  if (countOnly) {
    return JSON.stringify({ n: roster.playerCurrent });
  }
  const names = roster.players ? [...roster.players].sort() : [];
  return JSON.stringify({ n: roster.playerCurrent, names });
}

export async function loadLegacyPlayerListMessageState(): Promise<{
  messageId: string;
} | null> {
  try {
    const raw = await readFile(LEGACY_PLAYER_LIST_STATE_PATH, 'utf-8');
    return JSON.parse(raw) as { messageId: string };
  } catch {
    return null;
  }
}
