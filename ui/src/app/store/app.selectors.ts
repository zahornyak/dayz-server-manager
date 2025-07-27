import { createSelector, createFeatureSelector } from '@ngrx/store';
import { AppState, ServerInfo, PlayerInfo, SystemMetrics } from './app.state';

// Feature selectors
export const selectServerState = createFeatureSelector<AppState['servers']>('servers');
export const selectPlayerState = createFeatureSelector<AppState['players']>('players');
export const selectMetricsState = createFeatureSelector<AppState['metrics']>('metrics');
export const selectNotificationState = createFeatureSelector<AppState['notifications']>('notifications');
export const selectUIState = createFeatureSelector<AppState['ui']>('ui');

// Server selectors
export const selectAllServers = createSelector(
  selectServerState,
  state => Object.values(state.entities)
);

export const selectSelectedServerId = createSelector(
  selectServerState,
  state => state.selectedId
);

export const selectSelectedServer = createSelector(
  selectServerState,
  selectSelectedServerId,
  (state, selectedId) => selectedId ? state.entities[selectedId] : null
);

export const selectOnlineServers = createSelector(
  selectAllServers,
  servers => servers.filter(server => server.status === 'online')
);

export const selectOfflineServers = createSelector(
  selectAllServers,
  servers => servers.filter(server => server.status === 'offline')
);

export const selectServersLoading = createSelector(
  selectServerState,
  state => state.loading
);

export const selectServersError = createSelector(
  selectServerState,
  state => state.error
);

export const selectServerById = (serverId: string) => createSelector(
  selectServerState,
  state => state.entities[serverId]
);

// Player selectors
export const selectAllPlayers = createSelector(
  selectPlayerState,
  state => Object.values(state.entities)
);

export const selectPlayersByServer = (serverId: string) => createSelector(
  selectAllPlayers,
  players => players.filter(player => player.serverId === serverId)
);

export const selectAlivePlayers = createSelector(
  selectAllPlayers,
  players => players.filter(player => player.isAlive)
);

export const selectPlayersLoading = createSelector(
  selectPlayerState,
  state => state.loading
);

export const selectPlayersError = createSelector(
  selectPlayerState,
  state => state.error
);

export const selectPlayerById = (playerId: string) => createSelector(
  selectPlayerState,
  state => state.entities[playerId]
);

// Metrics selectors
export const selectMetricsByServer = (serverId: string) => createSelector(
  selectMetricsState,
  state => state.entities[serverId] || []
);

export const selectLatestMetricsByServer = (serverId: string) => createSelector(
  selectMetricsByServer(serverId),
  metrics => metrics.length > 0 ? metrics[metrics.length - 1] : null
);

export const selectMetricsLoading = createSelector(
  selectMetricsState,
  state => state.loading
);

export const selectMetricsError = createSelector(
  selectMetricsState,
  state => state.error
);

// Notification selectors
export const selectAllNotifications = createSelector(
  selectNotificationState,
  state => state.notifications
);

export const selectUnreadNotifications = createSelector(
  selectAllNotifications,
  notifications => notifications.filter(notification => !notification.read)
);

export const selectUnreadNotificationCount = createSelector(
  selectUnreadNotifications,
  notifications => notifications.length
);

export const selectRecentNotifications = createSelector(
  selectAllNotifications,
  notifications => notifications
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10)
);

// UI selectors
export const selectSidenavOpen = createSelector(
  selectUIState,
  state => state.sidenavOpen
);

export const selectLoading = createSelector(
  selectUIState,
  state => state.loading
);

export const selectDarkMode = createSelector(
  selectUIState,
  state => state.darkMode
);

export const selectCurrentView = createSelector(
  selectUIState,
  state => state.currentView
);

export const selectSelectedServerIdFromUI = createSelector(
  selectUIState,
  state => state.selectedServerId
);

// Combined selectors
export const selectDashboardData = createSelector(
  selectAllServers,
  selectSelectedServer,
  selectUnreadNotificationCount,
  (servers, selectedServer, unreadCount) => ({
    totalServers: servers.length,
    onlineServers: servers.filter(s => s.status === 'online').length,
    totalPlayers: servers.reduce((total, server) => total + server.playerCount, 0),
    selectedServer,
    unreadNotifications: unreadCount
  })
);

export const selectServerOverview = createSelector(
  selectAllServers,
  selectAllPlayers,
  (servers, players) => servers.map(server => ({
    ...server,
    players: players.filter(player => player.serverId === server.id),
    playerCount: players.filter(player => player.serverId === server.id).length
  }))
);

export const selectServerStats = (serverId: string) => createSelector(
  selectServerById(serverId),
  selectPlayersByServer(serverId),
  selectLatestMetricsByServer(serverId),
  (server, players, metrics) => ({
    server,
    players,
    metrics,
    playerCount: players.length,
    alivePlayers: players.filter(p => p.isAlive).length
  })
);