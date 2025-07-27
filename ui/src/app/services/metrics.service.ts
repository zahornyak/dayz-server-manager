import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, retry } from 'rxjs/operators';

import { SystemMetrics } from '../store/app.state';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MetricsService {

  constructor(private http: HttpClient) {}

  getMetrics(serverId: string): Observable<SystemMetrics[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/servers/${serverId}/metrics`).pipe(
      map(response => this.transformToSystemMetrics(response, serverId)),
      retry(environment.maxRetryAttempts),
      catchError(this.handleError)
    );
  }

  getCurrentMetrics(serverId: string): Observable<SystemMetrics> {
    return this.http.get<any>(`${environment.apiUrl}/servers/${serverId}/metrics/current`).pipe(
      map(response => this.transformToSystemMetrics([response], serverId)[0]),
      catchError(this.handleError)
    );
  }

  getServerLogs(serverId: string, lines: number = 100): Observable<string[]> {
    return this.http.get<any>(`${environment.apiUrl}/servers/${serverId}/logs?lines=${lines}`).pipe(
      map(response => response.logs || []),
      catchError(this.handleError)
    );
  }

  getPlayerMetrics(serverId: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/servers/${serverId}/metrics/players`).pipe(
      catchError(this.handleError)
    );
  }

  getServerEvents(serverId: string, limit: number = 50): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/servers/${serverId}/events?limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  private transformToSystemMetrics(response: any[], serverId: string): SystemMetrics[] {
    return response.map(metric => ({
      serverId: serverId,
      cpu: metric.cpu || metric.cpuUsage || 0,
      memory: metric.memory || metric.memoryUsage || metric.ram || 0,
      disk: metric.disk || metric.diskUsage || metric.storage || 0,
      network: {
        in: metric.network?.in || metric.networkIn || 0,
        out: metric.network?.out || metric.networkOut || 0
      },
      timestamp: metric.timestamp ? new Date(metric.timestamp) : new Date()
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
        errorMessage = 'Metrics endpoint not found.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
    }

    console.error('MetricsService Error:', error);
    return throwError(errorMessage);
  }
}