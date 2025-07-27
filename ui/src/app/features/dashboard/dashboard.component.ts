import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';

import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState, ServerInfo } from '../../store/app.state';
import * as AppSelectors from '../../store/app.selectors';
import * as AppActions from '../../store/app.actions';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatGridListModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTableModule
  ],
  template: `
    <div class="dashboard-container">
      <h1>Server Manager Dashboard</h1>
      
      <!-- Dashboard Overview Cards -->
      <div class="dashboard-cards">
        <mat-card class="stat-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>dns</mat-icon>
              Total Servers
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="stat-number">{{(dashboardData$ | async)?.totalServers || 0}}</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>check_circle</mat-icon>
              Online Servers
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="stat-number success">{{(dashboardData$ | async)?.onlineServers || 0}}</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>group</mat-icon>
              Total Players
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="stat-number">{{(dashboardData$ | async)?.totalPlayers || 0}}</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>notifications</mat-icon>
              Unread Alerts
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="stat-number warning">{{(dashboardData$ | async)?.unreadNotifications || 0}}</div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Server Overview Table -->
      <mat-card class="server-overview-card">
        <mat-card-header>
          <mat-card-title>Server Overview</mat-card-title>
          <div class="header-actions">
            <button mat-raised-button color="primary" (click)="refreshData()">
              <mat-icon>refresh</mat-icon>
              Refresh
            </button>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div class="table-container">
            <table mat-table [dataSource]="(servers$ | async) || []" class="servers-table">
              
              <!-- Server Name Column -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Server Name</th>
                <td mat-cell *matCellDef="let server">
                  <div class="server-info">
                    <strong>{{server.name}}</strong>
                    <div class="server-details">{{server.host}}:{{server.port}}</div>
                  </div>
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let server">
                  <mat-chip [class]="'status-' + server.status">
                    <mat-icon matChipIcon>{{getStatusIcon(server.status)}}</mat-icon>
                    {{server.status | titlecase}}
                  </mat-chip>
                </td>
              </ng-container>

              <!-- Players Column -->
              <ng-container matColumnDef="players">
                <th mat-header-cell *matHeaderCellDef>Players</th>
                <td mat-cell *matCellDef="let server">
                  <div class="player-info">
                    <span class="player-count">{{server.playerCount}}/{{server.maxPlayers}}</span>
                    <mat-progress-bar 
                      mode="determinate" 
                      [value]="(server.playerCount / server.maxPlayers) * 100"
                      class="player-progress">
                    </mat-progress-bar>
                  </div>
                </td>
              </ng-container>

              <!-- Map Column -->
              <ng-container matColumnDef="map">
                <th mat-header-cell *matHeaderCellDef>Map</th>
                <td mat-cell *matCellDef="let server">
                  <mat-chip>{{server.map | titlecase}}</mat-chip>
                </td>
              </ng-container>

              <!-- Last Update Column -->
              <ng-container matColumnDef="lastUpdate">
                <th mat-header-cell *matHeaderCellDef>Last Update</th>
                <td mat-cell *matCellDef="let server">
                  {{server.lastUpdate | date:'short'}}
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let server">
                  <button mat-icon-button (click)="selectServer(server.id)">
                    <mat-icon>visibility</mat-icon>
                  </button>
                  <button mat-icon-button (click)="manageServer(server.id)">
                    <mat-icon>settings</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h2>Quick Actions</h2>
        <div class="action-buttons">
          <button mat-raised-button color="primary" (click)="addServer()">
            <mat-icon>add</mat-icon>
            Add Server
          </button>
          <button mat-raised-button (click)="viewLogs()">
            <mat-icon>article</mat-icon>
            View Logs
          </button>
          <button mat-raised-button (click)="openMap()">
            <mat-icon>map</mat-icon>
            Live Map
          </button>
          <button mat-raised-button (click)="openSettings()">
            <mat-icon>settings</mat-icon>
            Settings
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  dashboardData$ = this.store.select(AppSelectors.selectDashboardData);
  servers$ = this.store.select(AppSelectors.selectServerOverview);
  loading$ = this.store.select(AppSelectors.selectLoading);

  displayedColumns: string[] = ['name', 'status', 'players', 'map', 'lastUpdate', 'actions'];

  constructor(private store: Store<AppState>) {}

  ngOnInit(): void {
    this.refreshData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshData(): void {
    this.store.dispatch(AppActions.loadServers());
  }

  selectServer(serverId: string): void {
    this.store.dispatch(AppActions.selectServer({ serverId }));
  }

  manageServer(serverId: string): void {
    // Navigate to server management
    console.log('Manage server:', serverId);
  }

  addServer(): void {
    // Open add server dialog
    console.log('Add server dialog');
  }

  viewLogs(): void {
    // Navigate to logs
    console.log('View logs');
  }

  openMap(): void {
    // Navigate to map
    console.log('Open map');
  }

  openSettings(): void {
    // Navigate to settings
    console.log('Open settings');
  }

  getStatusIcon(status: ServerInfo['status']): string {
    switch (status) {
      case 'online': return 'check_circle';
      case 'offline': return 'cancel';
      case 'connecting': return 'sync';
      case 'error': return 'error';
      default: return 'help';
    }
  }
}