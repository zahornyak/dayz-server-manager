import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, timer } from 'rxjs';
import { map, catchError, retry, switchMap, shareReplay } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { ServerInfo } from '../store/app.state';
import { environment } from '../../environments/environment';

export interface ServerConfiguration {
  name: string;
  host: string;
  port: number;
  apiPort: number;
  ingameApiPort: number;
  map: string;
}

@Injectable({
  providedIn: 'root'
})
export class ServerService {
  private serversSubject = new BehaviorSubject<ServerInfo[]>([]);
  private pollingInterval = environment.defaultPollingInterval;

  constructor(private http: HttpClient) {
    this.initializePeriodicStatusCheck();
  }

  getServers(): Observable<ServerInfo[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/servers`).pipe(
      map(response => this.transformToServerInfo(response)),
      retry(environment.maxRetryAttempts),
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  addServer(serverConfig: ServerConfiguration): Observable<ServerInfo> {
    const newServer: ServerInfo = {
      id: uuidv4(),
      ...serverConfig,
      status: 'offline',
      version: '1.0.0',
      playerCount: 0,
      maxPlayers: 60,
      lastUpdate: new Date(),
      isSelected: false
    };

    return this.http.post<ServerInfo>(`${environment.apiUrl}/servers`, newServer).pipe(
      catchError(this.handleError)
    );
  }

  removeServer(serverId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/servers/${serverId}`).pipe(
      catchError(this.handleError)
    );
  }

  connectToServer(serverId: string): Observable<ServerInfo['status']> {
    return this.http.post<{ status: ServerInfo['status'] }>(`${environment.apiUrl}/servers/${serverId}/connect`, {}).pipe(
      map(response => response.status),
      catchError(this.handleError)
    );
  }

  getServerStatus(serverId: string): Observable<ServerInfo> {
    return this.http.get<ServerInfo>(`${environment.apiUrl}/servers/${serverId}/status`).pipe(
      catchError(this.handleError)
    );
  }

  restartServer(serverId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/servers/${serverId}/restart`, {}).pipe(
      catchError(this.handleError)
    );
  }

  startServer(serverId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/servers/${serverId}/start`, {}).pipe(
      catchError(this.handleError)
    );
  }

  stopServer(serverId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/servers/${serverId}/stop`, {}).pipe(
      catchError(this.handleError)
    );
  }

  sendGlobalMessage(serverId: string, message: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/servers/${serverId}/global-message`, { message }).pipe(
      catchError(this.handleError)
    );
  }

  // Multi-backend support methods
  getServersByBackend(backendHost: string): Observable<ServerInfo[]> {
    const customApiUrl = `http://${backendHost}:${environment.apiUrl.replace('/api', '')}`;
    return this.http.get<any[]>(`${customApiUrl}/api/servers`).pipe(
      map(response => this.transformToServerInfo(response)),
      catchError(this.handleError)
    );
  }

  testBackendConnection(host: string, port: number): Observable<boolean> {
    return this.http.get<{ status: string }>(`http://${host}:${port}/api/ping`).pipe(
      map(response => response.status === 'ok'),
      catchError(() => throwError(false))
    );
  }

  private initializePeriodicStatusCheck(): void {
    if (!environment.multiBackendSupport) return;

    timer(0, this.pollingInterval).pipe(
      switchMap(() => this.getServers())
    ).subscribe(servers => {
      this.serversSubject.next(servers);
    });
  }

  private transformToServerInfo(response: any[]): ServerInfo[] {
    return response.map(server => ({
      id: server.id || uuidv4(),
      name: server.hostname || server.name || 'Unknown Server',
      host: server.host || 'localhost',
      port: server.port || 2302,
      apiPort: server.apiPort || server.webPort || 2313,
      ingameApiPort: server.ingameApiPort || 2312,
      status: this.mapServerStatus(server.status),
      version: server.version || '1.0.0',
      playerCount: server.playerCount || server.players?.length || 0,
      maxPlayers: server.maxPlayers || 60,
      map: server.map || server.mission?.template?.split('.')[1] || 'chernarus',
      lastUpdate: server.lastUpdate ? new Date(server.lastUpdate) : new Date(),
      isSelected: false
    }));
  }

  private mapServerStatus(status: any): ServerInfo['status'] {
    if (!status) return 'offline';
    
    switch (status.toLowerCase()) {
      case 'running':
      case 'online':
      case 'active':
        return 'online';
      case 'connecting':
      case 'starting':
        return 'connecting';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'offline';
    }
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
        errorMessage = 'Server endpoint not found. Please check the API configuration.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
    }

    console.error('ServerService Error:', error);
    return throwError(errorMessage);
  }
}