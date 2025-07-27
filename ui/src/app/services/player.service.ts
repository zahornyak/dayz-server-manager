import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, retry } from 'rxjs/operators';

import { PlayerInfo } from '../store/app.state';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PlayerService {

  constructor(private http: HttpClient) {}

  getPlayers(serverId: string): Observable<PlayerInfo[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/servers/${serverId}/players`).pipe(
      map(response => this.transformToPlayerInfo(response, serverId)),
      retry(environment.maxRetryAttempts),
      catchError(this.handleError)
    );
  }

  getPlayer(serverId: string, playerId: string): Observable<PlayerInfo> {
    return this.http.get<any>(`${environment.apiUrl}/servers/${serverId}/players/${playerId}`).pipe(
      map(response => this.transformToPlayerInfo([response], serverId)[0]),
      catchError(this.handleError)
    );
  }

  kickPlayer(serverId: string, playerId: string, reason?: string): Observable<void> {
    const body = { reason: reason || 'Kicked by admin' };
    return this.http.post<void>(`${environment.apiUrl}/servers/${serverId}/players/${playerId}/kick`, body).pipe(
      catchError(this.handleError)
    );
  }

  banPlayer(serverId: string, playerId: string, reason?: string, duration?: number): Observable<void> {
    const body = { 
      reason: reason || 'Banned by admin',
      duration: duration || 0 // 0 = permanent
    };
    return this.http.post<void>(`${environment.apiUrl}/servers/${serverId}/players/${playerId}/ban`, body).pipe(
      catchError(this.handleError)
    );
  }

  unbanPlayer(serverId: string, playerId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/servers/${serverId}/players/${playerId}/ban`).pipe(
      catchError(this.handleError)
    );
  }

  sendPrivateMessage(serverId: string, playerId: string, message: string): Observable<void> {
    const body = { message };
    return this.http.post<void>(`${environment.apiUrl}/servers/${serverId}/players/${playerId}/message`, body).pipe(
      catchError(this.handleError)
    );
  }

  teleportPlayer(serverId: string, playerId: string, position: { x: number; y: number; z: number }): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/servers/${serverId}/players/${playerId}/teleport`, position).pipe(
      catchError(this.handleError)
    );
  }

  healPlayer(serverId: string, playerId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/servers/${serverId}/players/${playerId}/heal`, {}).pipe(
      catchError(this.handleError)
    );
  }

  getBannedPlayers(serverId: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/servers/${serverId}/bans`).pipe(
      catchError(this.handleError)
    );
  }

  getPlayerInventory(serverId: string, playerId: string): Observable<any> {
    return this.http.get<any>(`${environment.ingameApiUrl}/servers/${serverId}/players/${playerId}/inventory`).pipe(
      catchError(this.handleError)
    );
  }

  getPlayerStats(serverId: string, playerId: string): Observable<any> {
    return this.http.get<any>(`${environment.ingameApiUrl}/servers/${serverId}/players/${playerId}/stats`).pipe(
      catchError(this.handleError)
    );
  }

  private transformToPlayerInfo(response: any[], serverId: string): PlayerInfo[] {
    return response.map(player => ({
      id: player.id || player.steamId || `${serverId}-${player.name}`,
      name: player.name || player.playerName || 'Unknown Player',
      serverId: serverId,
      steamId: player.steamId || player.steam64 || '',
      position: {
        x: player.position?.x || player.x || 0,
        y: player.position?.y || player.y || 0,
        z: player.position?.z || player.z || 0
      },
      health: player.health || player.hp || 100,
      isAlive: player.isAlive !== undefined ? player.isAlive : player.health > 0,
      playtime: player.playtime || player.sessionTime || 0,
      lastSeen: player.lastSeen ? new Date(player.lastSeen) : new Date()
    }));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      
      if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      } else if (error.status === 404) {
        errorMessage = 'Player or endpoint not found.';
      } else if (error.status === 403) {
        errorMessage = 'Access denied. Insufficient permissions.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
    }

    console.error('PlayerService Error:', error);
    return throwError(errorMessage);
  }
}