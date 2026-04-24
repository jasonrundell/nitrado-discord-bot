import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchServerStatus } from '../nitrado.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchServerStatus', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns a ServerStatusSnapshot with player info on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          gameserver: {
            status: 'started',
            query: {
              player_current: 5,
              player_max: 20,
            },
          },
        },
      }),
    });

    const snapshot = await fetchServerStatus('my-token', '12345');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.nitrado.net/services/12345/gameservers',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      }),
    );
    expect(snapshot.status).toBe('started');
    expect(snapshot.playerCurrent).toBe(5);
    expect(snapshot.playerMax).toBe(20);
    expect(snapshot.checkedAt).toBeInstanceOf(Date);
  });

  it('returns null player counts when query is null (server not fully started)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          gameserver: {
            status: 'stopped',
            query: null,
          },
        },
      }),
    });

    const snapshot = await fetchServerStatus('my-token', '12345');

    expect(snapshot.status).toBe('stopped');
    expect(snapshot.playerCurrent).toBeNull();
    expect(snapshot.playerMax).toBeNull();
  });

  it('throws on HTTP 401 Unauthorized', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(fetchServerStatus('bad-token', '12345')).rejects.toThrow(
      '401',
    );
  });

  it('throws on HTTP 429 rate limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    await expect(fetchServerStatus('my-token', '12345')).rejects.toThrow(
      '429',
    );
  });

  it('throws when Nitrado response status is not success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'error',
        data: null,
      }),
    });

    await expect(fetchServerStatus('my-token', '12345')).rejects.toThrow(
      'non-success status',
    );
  });

  it('throws on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(fetchServerStatus('my-token', '12345')).rejects.toThrow(
      'Network error',
    );
  });

  it('builds the correct URL using the provided service ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          gameserver: { status: 'started', query: null },
        },
      }),
    });

    await fetchServerStatus('token', '99999');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.nitrado.net/services/99999/gameservers',
      expect.anything(),
    );
  });
});
