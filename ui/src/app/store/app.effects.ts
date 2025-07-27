import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, switchMap, tap } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';

import * as AppActions from './app.actions';
import { ServerService } from '../services/server.service';
import { PlayerService } from '../services/player.service';
import { MetricsService } from '../services/metrics.service';

@Injectable()
export class AppEffects {

  constructor(
    private actions$: Actions,
    private serverService: ServerService,
    private playerService: PlayerService,
    private metricsService: MetricsService,
    private snackBar: MatSnackBar
  ) {}

  // Server Effects
  loadServers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadServers),
      switchMap(() =>
        this.serverService.getServers().pipe(
          map(servers => AppActions.loadServersSuccess({ servers })),
          catchError(error => of(AppActions.loadServersFailure({ error: error.message })))
        )
      )
    )
  );

  addServer$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.addServer),
      switchMap(({ server }) =>
        this.serverService.addServer(server).pipe(
          map(newServer => AppActions.addServerSuccess({ server: newServer })),
          catchError(error => of(AppActions.addServerFailure({ error: error.message })))
        )
      )
    )
  );

  connectToServer$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.connectToServer),
      switchMap(({ serverId }) =>
        this.serverService.connectToServer(serverId).pipe(
          map(status => AppActions.updateServerStatus({ serverId, status })),
          catchError(error => {
            this.showErrorNotification('Connection Failed', error.message);
            return of(AppActions.updateServerStatus({ serverId, status: 'error' }));
          })
        )
      )
    )
  );

  // Player Effects
  loadPlayers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadPlayers),
      switchMap(({ serverId }) =>
        this.playerService.getPlayers(serverId).pipe(
          map(players => AppActions.loadPlayersSuccess({ players })),
          catchError(error => of(AppActions.loadPlayersFailure({ error: error.message })))
        )
      )
    )
  );

  kickPlayer$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.kickPlayer),
      switchMap(({ serverId, playerId, reason }) =>
        this.playerService.kickPlayer(serverId, playerId, reason).pipe(
          tap(() => this.showSuccessNotification('Player Kicked', `Player has been kicked from the server`)),
          map(() => AppActions.loadPlayers({ serverId })),
          catchError(error => {
            this.showErrorNotification('Kick Failed', error.message);
            return of(AppActions.loadPlayersFailure({ error: error.message }));
          })
        )
      )
    )
  );

  banPlayer$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.banPlayer),
      switchMap(({ serverId, playerId, reason, duration }) =>
        this.playerService.banPlayer(serverId, playerId, reason, duration).pipe(
          tap(() => this.showSuccessNotification('Player Banned', `Player has been banned from the server`)),
          map(() => AppActions.loadPlayers({ serverId })),
          catchError(error => {
            this.showErrorNotification('Ban Failed', error.message);
            return of(AppActions.loadPlayersFailure({ error: error.message }));
          })
        )
      )
    )
  );

  // Metrics Effects
  loadMetrics$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadMetrics),
      switchMap(({ serverId }) =>
        this.metricsService.getMetrics(serverId).pipe(
          map(metrics => AppActions.loadMetricsSuccess({ serverId, metrics })),
          catchError(error => of(AppActions.loadMetricsFailure({ error: error.message })))
        )
      )
    )
  );

  // Server Management Effects
  restartServer$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.restartServer),
      switchMap(({ serverId }) =>
        this.serverService.restartServer(serverId).pipe(
          tap(() => this.showSuccessNotification('Server Restart', 'Server restart initiated')),
          map(() => AppActions.updateServerStatus({ serverId, status: 'connecting' })),
          catchError(error => {
            this.showErrorNotification('Restart Failed', error.message);
            return of(AppActions.updateServerStatus({ serverId, status: 'error' }));
          })
        )
      )
    )
  );

  startServer$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.startServer),
      switchMap(({ serverId }) =>
        this.serverService.startServer(serverId).pipe(
          tap(() => this.showSuccessNotification('Server Start', 'Server start initiated')),
          map(() => AppActions.updateServerStatus({ serverId, status: 'connecting' })),
          catchError(error => {
            this.showErrorNotification('Start Failed', error.message);
            return of(AppActions.updateServerStatus({ serverId, status: 'error' }));
          })
        )
      )
    )
  );

  stopServer$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.stopServer),
      switchMap(({ serverId }) =>
        this.serverService.stopServer(serverId).pipe(
          tap(() => this.showSuccessNotification('Server Stop', 'Server stop initiated')),
          map(() => AppActions.updateServerStatus({ serverId, status: 'offline' })),
          catchError(error => {
            this.showErrorNotification('Stop Failed', error.message);
            return of(AppActions.updateServerStatus({ serverId, status: 'error' }));
          })
        )
      )
    )
  );

  sendGlobalMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.sendGlobalMessage),
      switchMap(({ serverId, message }) =>
        this.serverService.sendGlobalMessage(serverId, message).pipe(
          tap(() => this.showSuccessNotification('Message Sent', 'Global message has been sent')),
          map(() => AppActions.setLoading({ loading: false })),
          catchError(error => {
            this.showErrorNotification('Message Failed', error.message);
            return of(AppActions.setLoading({ loading: false }));
          })
        )
      )
    )
  );

  // Notification Effects
  showNotification$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.addNotification),
      tap(({ notificationType, title, message }) => {
        this.snackBar.open(`${title}: ${message}`, 'Close', {
          duration: notificationType === 'error' ? 0 : 5000,
          panelClass: [`snackbar-${notificationType}`]
        });
      })
    ), 
    { dispatch: false }
  );

  private showSuccessNotification(title: string, message: string): void {
    this.snackBar.open(`${title}: ${message}`, 'Close', {
      duration: 3000,
      panelClass: ['snackbar-success']
    });
  }

  private showErrorNotification(title: string, message: string): void {
    this.snackBar.open(`${title}: ${message}`, 'Close', {
      duration: 0,
      panelClass: ['snackbar-error']
    });
  }
}