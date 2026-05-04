import { describe, it, expect } from 'vitest';
import {
  parseRosterFromLogTail,
  sanitizePlayerName,
  rosterFromFtpLogNames,
  DEFAULT_LOG_JOIN_REGEXES,
  DEFAULT_LOG_LEAVE_REGEXES,
} from '../ftpLogPlayers.js';

describe('sanitizePlayerName', () => {
  it('trims and strips control characters', () => {
    expect(sanitizePlayerName('  Code\x00Blink  ')).toBe('CodeBlink');
  });

  it('removes wrapping quotes', () => {
    expect(sanitizePlayerName('"SeaDog"')).toBe('SeaDog');
  });
});

describe('parseRosterFromLogTail', () => {
  it('adds players from LogNet Join succeeded lines', () => {
    const log = `
[000]LogNet: Join succeeded: CodeBlink
[001]noise
[002]LogNet: Join succeeded: FirstMate
`;
    const names = parseRosterFromLogTail(
      log,
      DEFAULT_LOG_JOIN_REGEXES,
      DEFAULT_LOG_LEAVE_REGEXES,
    );
    expect(names).toEqual(['CodeBlink', 'FirstMate']);
  });

  it('removes players when a leave regex matches', () => {
    const join = [/LogNet:\s*Join succeeded:\s*(.+?)\s*$/i];
    const leave = [/^LEAVE:\s*(.+?)\s*$/i];
    const log = `
LogNet: Join succeeded: Alice
LogNet: Join succeeded: Bob
LEAVE: Alice
`;
    expect(parseRosterFromLogTail(log, join, leave)).toEqual(['Bob']);
  });

  it('processes leave before join on the same line would not double-apply', () => {
    const join = [/JOIN\s+(\w+)/i];
    const leave = [/DROP\s+(\w+)/i];
    const log = 'JOIN Alpha\nJOIN Beta\nDROP Alpha';
    expect(parseRosterFromLogTail(log, join, leave)).toEqual(['Beta']);
  });

  it('parses Windrose R5.log join lines from samples/R5.log shape', () => {
    const log = `[2026.05.02-14.42.34:357][613]LogNet: Join succeeded: CodeBlink
[2026.05.02-14.42.35:000][614]R5LogDataKeeper:              [425614] IR5DataKeeperStateLogger::LogSetState              ServerAccount. AccountName 'CodeBlink'. AccountId B581A52B4A38C0CDF03701A6E115B632. PlayerState BP_R5PlayerState_C_2147417529
`;
    const names = parseRosterFromLogTail(
      log,
      DEFAULT_LOG_JOIN_REGEXES,
      DEFAULT_LOG_LEAVE_REGEXES,
    );
    expect(names).toEqual(['CodeBlink']);
  });

  it('removes players listed under Disconnected Accounts (Windrose data-keeper dump)', () => {
    const log = `
LogNet: Join succeeded: CodeBlink
Connected Accounts
     1. Name 'CodeBlink'. AccountId 'x'. State 'InGame'.
Disconnected Accounts
     1. Name 'CodeBlink'. AccountId 'x'. State 'Gone'.
 [D:\\Source\\ignored.cpp:1]
[2026.05.02-14.50.00:000][700]LogNet: UNetDriver::TickDispatch
`;
    expect(
      parseRosterFromLogTail(
        log,
        DEFAULT_LOG_JOIN_REGEXES,
        DEFAULT_LOG_LEAVE_REGEXES,
      ),
    ).toEqual([]);
  });
});

describe('rosterFromFtpLogNames', () => {
  it('marks roster as ftp_log and sets count from names length', () => {
    const t = new Date('2026-05-02T12:00:00Z');
    const r = rosterFromFtpLogNames(['A', 'B'], t);
    expect(r.playerCurrent).toBe(2);
    expect(r.playerMax).toBeNull();
    expect(r.players).toEqual(['A', 'B']);
    expect(r.rosterSource).toBe('ftp_log');
    expect(r.checkedAt).toBe(t);
  });
});
