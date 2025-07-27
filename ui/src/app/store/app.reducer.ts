import { createReducer, on, ActionReducerMap } from '@ngrx/store';
import { routerReducer } from '@ngrx/router-store';
import { v4 as uuidv4 } from 'uuid';
import { AppState, ServerInfo, PlayerInfo, SystemMetrics, NotificationState, UIState } from './app.state';
import * as AppActions from './app.actions';

// Initial States with proper typing
const initialServerState: AppState['servers'] = {
  entities: {},
  selectedId: null,
  loading: false,
  error: null
};

const initialPlayerState: AppState['players'] = {
  entities: {},
  loading: false,
  error: null
};

const initialMetricsState: AppState['metrics'] = {
  entities: {},
  loading: false,
  error: null
};

const initialNotificationState: NotificationState = {
  notifications: []
};

const initialUIState: UIState = {
  sidenavOpen: true,
  loading: false,
  darkMode: false,
  selectedServerId: null,
  currentView: 'dashboard'
};

// Server Reducer
const serverReducer = createReducer(
  initialServerState,
  on(AppActions.loadServers, state => ({ ...state, loading: true, error: null })),
  on(AppActions.loadServersSuccess, (state, { servers }) => ({
    ...state,
    loading: false,
    entities: servers.reduce((acc, server) => ({ ...acc, [server.id]: server }), {} as { [id: string]: ServerInfo })
  })),
  on(AppActions.loadServersFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(AppActions.addServerSuccess, (state, { server }) => ({
    ...state,
    entities: { ...state.entities, [server.id]: server }
  })),
  on(AppActions.removeServer, (state, { serverId }) => {
    const { [serverId]: removed, ...entities } = state.entities;
    return { 
      ...state, 
      entities,
      selectedId: state.selectedId === serverId ? null : state.selectedId
    };
  }),
  on(AppActions.selectServer, (state, { serverId }) => ({ ...state, selectedId: serverId })),
  on(AppActions.updateServerStatus, (state, { serverId, status }) => ({
    ...state,
    entities: {
      ...state.entities,
      [serverId]: state.entities[serverId] ? { 
        ...state.entities[serverId], 
        status,
        lastUpdate: new Date()
      } : state.entities[serverId]
    }
  }))
);

// Player Reducer
const playerReducer = createReducer(
  initialPlayerState,
  on(AppActions.loadPlayers, state => ({ ...state, loading: true, error: null })),
  on(AppActions.loadPlayersSuccess, (state, { players }) => ({
    ...state,
    loading: false,
    entities: players.reduce((acc, player) => ({ ...acc, [player.id]: player }), {} as { [id: string]: PlayerInfo })
  })),
  on(AppActions.loadPlayersFailure, (state, { error }) => ({ ...state, loading: false, error }))
);

// Metrics Reducer
const metricsReducer = createReducer(
  initialMetricsState,
  on(AppActions.loadMetrics, state => ({ ...state, loading: true, error: null })),
  on(AppActions.loadMetricsSuccess, (state, { serverId, metrics }) => ({
    ...state,
    loading: false,
    entities: {
      ...state.entities,
      [serverId]: metrics
    }
  })),
  on(AppActions.loadMetricsFailure, (state, { error }) => ({ ...state, loading: false, error }))
);

// Notification Reducer
const notificationReducer = createReducer(
  initialNotificationState,
  on(AppActions.addNotification, (state, { notificationType, title, message }) => ({
    ...state,
    notifications: [
      ...state.notifications,
      {
        id: uuidv4(),
        type: notificationType,
        title,
        message,
        timestamp: new Date(),
        read: false
      }
    ]
  })),
  on(AppActions.removeNotification, (state, { id }) => ({
    ...state,
    notifications: state.notifications.filter(notification => notification.id !== id)
  })),
  on(AppActions.markNotificationAsRead, (state, { id }) => ({
    ...state,
    notifications: state.notifications.map(notification => 
      notification.id === id ? { ...notification, read: true } : notification
    )
  }))
);

// UI Reducer
const uiReducer = createReducer(
  initialUIState,
  on(AppActions.toggleSidenav, state => ({ ...state, sidenavOpen: !state.sidenavOpen })),
  on(AppActions.setLoading, (state, { loading }) => ({ ...state, loading })),
  on(AppActions.toggleDarkMode, state => ({ ...state, darkMode: !state.darkMode })),
  on(AppActions.setCurrentView, (state, { view }) => ({ ...state, currentView: view })),
  on(AppActions.selectServer, (state, { serverId }) => ({ ...state, selectedServerId: serverId }))
);

// App Reducers
export const appReducers: ActionReducerMap<AppState> = {
  servers: serverReducer,
  players: playerReducer,
  metrics: metricsReducer,
  notifications: notificationReducer,
  ui: uiReducer,
  router: routerReducer
};