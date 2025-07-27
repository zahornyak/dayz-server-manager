import { RouterReducerState } from '@ngrx/router-store';

export interface ServerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  apiPort: number;
  ingameApiPort: number;
  status: 'online' | 'offline' | 'connecting' | 'error';
  version: string;
  playerCount: number;
  maxPlayers: number;
  map: string;
  lastUpdate: Date;
  isSelected: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  serverId: string;
  steamId: string;
  position: { x: number; y: number; z: number };
  health: number;
  isAlive: boolean;
  playtime: number;
  lastSeen: Date;
}

export interface SystemMetrics {
  serverId: string;
  cpu: number;
  memory: number;
  disk: number;
  network: { in: number; out: number };
  timestamp: Date;
}

export interface NotificationState {
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }>;
}

export interface UIState {
  sidenavOpen: boolean;
  loading: boolean;
  darkMode: boolean;
  selectedServerId: string | null;
  currentView: string;
}

export interface AppState {
  servers: {
    entities: { [id: string]: ServerInfo };
    selectedId: string | null;
    loading: boolean;
    error: string | null;
  };
  players: {
    entities: { [id: string]: PlayerInfo };
    loading: boolean;
    error: string | null;
  };
  metrics: {
    entities: { [serverId: string]: SystemMetrics[] };
    loading: boolean;
    error: string | null;
  };
  notifications: NotificationState;
  ui: UIState;
  router: RouterReducerState<any>;
}