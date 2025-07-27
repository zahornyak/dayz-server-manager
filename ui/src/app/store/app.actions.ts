import { createAction, props } from '@ngrx/store';
import { ServerInfo, PlayerInfo, SystemMetrics } from './app.state';

// Server Actions
export const loadServers = createAction('[Server] Load Servers');
export const loadServersSuccess = createAction(
  '[Server] Load Servers Success',
  props<{ servers: ServerInfo[] }>()
);
export const loadServersFailure = createAction(
  '[Server] Load Servers Failure',
  props<{ error: string }>()
);

export const addServer = createAction(
  '[Server] Add Server',
  props<{ server: Omit<ServerInfo, 'id' | 'status' | 'lastUpdate'> }>()
);
export const addServerSuccess = createAction(
  '[Server] Add Server Success',
  props<{ server: ServerInfo }>()
);
export const addServerFailure = createAction(
  '[Server] Add Server Failure',
  props<{ error: string }>()
);

export const removeServer = createAction(
  '[Server] Remove Server',
  props<{ serverId: string }>()
);

export const selectServer = createAction(
  '[Server] Select Server',
  props<{ serverId: string }>()
);

export const updateServerStatus = createAction(
  '[Server] Update Server Status',
  props<{ serverId: string; status: ServerInfo['status'] }>()
);

export const connectToServer = createAction(
  '[Server] Connect To Server',
  props<{ serverId: string }>()
);

// Player Actions
export const loadPlayers = createAction(
  '[Player] Load Players',
  props<{ serverId: string }>()
);
export const loadPlayersSuccess = createAction(
  '[Player] Load Players Success',
  props<{ players: PlayerInfo[] }>()
);
export const loadPlayersFailure = createAction(
  '[Player] Load Players Failure',
  props<{ error: string }>()
);

export const kickPlayer = createAction(
  '[Player] Kick Player',
  props<{ serverId: string; playerId: string; reason?: string }>()
);

export const banPlayer = createAction(
  '[Player] Ban Player',
  props<{ serverId: string; playerId: string; reason?: string; duration?: number }>()
);

// Metrics Actions
export const loadMetrics = createAction(
  '[Metrics] Load Metrics',
  props<{ serverId: string }>()
);
export const loadMetricsSuccess = createAction(
  '[Metrics] Load Metrics Success',
  props<{ serverId: string; metrics: SystemMetrics[] }>()
);
export const loadMetricsFailure = createAction(
  '[Metrics] Load Metrics Failure',
  props<{ error: string }>()
);

// UI Actions
export const toggleSidenav = createAction('[UI] Toggle Sidenav');
export const setLoading = createAction(
  '[UI] Set Loading',
  props<{ loading: boolean }>()
);
export const toggleDarkMode = createAction('[UI] Toggle Dark Mode');
export const setCurrentView = createAction(
  '[UI] Set Current View',
  props<{ view: string }>()
);

// Notification Actions
export const addNotification = createAction(
  '[Notification] Add Notification',
  props<{ 
    notificationType: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>()
);
export const removeNotification = createAction(
  '[Notification] Remove Notification',
  props<{ id: string }>()
);
export const markNotificationAsRead = createAction(
  '[Notification] Mark As Read',
  props<{ id: string }>()
);

// Server Management Actions
export const restartServer = createAction(
  '[Server Management] Restart Server',
  props<{ serverId: string }>()
);
export const stopServer = createAction(
  '[Server Management] Stop Server',
  props<{ serverId: string }>()
);
export const startServer = createAction(
  '[Server Management] Start Server',
  props<{ serverId: string }>()
);
export const sendGlobalMessage = createAction(
  '[Server Management] Send Global Message',
  props<{ serverId: string; message: string }>()
);