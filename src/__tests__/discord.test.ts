import { describe, it, expect, vi } from 'vitest';
import { formatStatusMessage, sendStatusMessage } from '../discord.js';
import type { ServerStatus } from '../types.js';

vi.mock('discord.js', () => ({
  Client: vi.fn(),
  GatewayIntentBits: { Guilds: 1 },
  TextChannel: class TextChannel {},
}));

describe('formatStatusMessage', () => {
  it('shows startup message when oldStatus is null', () => {
    const msg = formatStatusMessage(null, 'started', 10, 20);
    expect(msg).toContain('startup');
    expect(msg).toContain('started');
    expect(msg).toContain('🟢');
    expect(msg).toContain('10/20');
  });

  it('shows status change with arrow when oldStatus is provided', () => {
    const msg = formatStatusMessage('started', 'stopped', null, null);
    expect(msg).toContain('changed');
    expect(msg).toContain('started');
    expect(msg).toContain('stopped');
    expect(msg).toContain('→');
    expect(msg).toContain('🔴');
  });

  it('includes player counts when both are provided', () => {
    const msg = formatStatusMessage('stopped', 'started', 3, 16);
    expect(msg).toContain('3/16');
  });

  it('omits player info when counts are null', () => {
    const msg = formatStatusMessage(null, 'stopped', null, null);
    expect(msg).not.toContain('Players:');
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
      const msg = formatStatusMessage(null, status, null, null);
      expect(msg).toContain(emoji);
    }
  });

  it('includes a UTC timestamp in the message', () => {
    const msg = formatStatusMessage(null, 'started', null, null);
    expect(msg).toMatch(/\w{3}, \d{2} \w{3} \d{4}/);
  });

  it('wraps status values in backticks', () => {
    const msg = formatStatusMessage('stopped', 'started', null, null);
    expect(msg).toContain('`stopped`');
    expect(msg).toContain('`started`');
  });
});

describe('sendStatusMessage', () => {
  it('calls channel.send with the formatted message', async () => {
    const mockSend = vi.fn().mockResolvedValue(undefined);
    const mockChannel = { send: mockSend } as never;

    await sendStatusMessage(mockChannel, null, 'started', 5, 20);

    expect(mockSend).toHaveBeenCalledOnce();
    const [message] = mockSend.mock.calls[0] as [string];
    expect(message).toContain('started');
    expect(message).toContain('5/20');
  });

  it('passes the correct old and new status through to the message', async () => {
    const mockSend = vi.fn().mockResolvedValue(undefined);
    const mockChannel = { send: mockSend } as never;

    await sendStatusMessage(mockChannel, 'started', 'stopped', null, null);

    const [message] = mockSend.mock.calls[0] as [string];
    expect(message).toContain('`started`');
    expect(message).toContain('`stopped`');
  });
});
