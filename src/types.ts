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
  checkedAt: Date;
}
