import type { NitradoGameserverResponse, ServerStatusSnapshot } from './types.js';

const NITRADO_API_BASE = 'https://api.nitrado.net';

export async function fetchServerStatus(
  token: string,
  serviceId: string,
): Promise<ServerStatusSnapshot> {
  const url = `${NITRADO_API_BASE}/services/${serviceId}/gameservers`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Nitrado API error: ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as NitradoGameserverResponse;

  if (json.status !== 'success') {
    throw new Error(
      `Nitrado API returned non-success status: ${json.status}`,
    );
  }

  const { gameserver } = json.data;
  const query = gameserver.query;

  return {
    status: gameserver.status,
    playerCurrent: query?.player_current ?? null,
    playerMax: query?.player_max ?? null,
    checkedAt: new Date(),
  };
}
