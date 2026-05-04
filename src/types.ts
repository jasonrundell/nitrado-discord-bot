export type ServerStatus =
  | 'started'
  | 'stopped'
  | 'stopping'
  | 'restarting'
  | 'suspended'
  | 'unknown';

export interface GameserverQuery {
  server_name: string;
  connect_ip: string;
  map: string;
  version: string;
  player_current: number;
  player_max: number;
  players: string[];
}

export interface GameserverDetails {
  status: ServerStatus;
  query_status: string;
  query: GameserverQuery | null;
  game_human: string;
  game_specific: Record<string, unknown>;
}

export interface NitradoGameserverResponse {
  status: string;
  data: {
    gameserver: GameserverDetails;
  };
}

export interface ServerStatusSnapshot {
  status: ServerStatus;
  playerCurrent: number | null;
  playerMax: number | null;
  /** null when the server query is unavailable; [] when query is up but no players or names not returned */
  players: string[] | null;
  checkedAt: Date;
}

/** Roster data from Nitrado query or FTP log parser, for the dashboard embed. */
export interface PlayerRosterSnapshot {
  playerCurrent: number | null;
  playerMax: number | null;
  players: string[] | null;
  checkedAt: Date;
  rosterSource?: 'nitrado' | 'ftp_log';
}

export interface FtpLogConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  remotePath: string;
  tailBytes: number;
  secure: boolean;
  timeoutMs: number;
  joinRegexes: RegExp[];
  leaveRegexes: RegExp[];
  /** When true, Discord edits only when `playerCurrent` changes (names refresh on that edit). */
  signatureCountOnly: boolean;
}
