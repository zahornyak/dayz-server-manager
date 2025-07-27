import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { map, shareReplay, takeUntil, filter } from 'rxjs/operators';

import { AppState, ServerInfo } from './store/app.state';
import * as AppActions from './store/app.actions';
import * as AppSelectors from './store/app.selectors';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatBadgeModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatDividerModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Observables for template
  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  sidenavOpen$ = this.store.select(AppSelectors.selectSidenavOpen);
  darkMode$ = this.store.select(AppSelectors.selectDarkMode);
  loading$ = this.store.select(AppSelectors.selectLoading);
  servers$ = this.store.select(AppSelectors.selectAllServers);
  selectedServer$ = this.store.select(AppSelectors.selectSelectedServer);
  unreadNotificationCount$ = this.store.select(AppSelectors.selectUnreadNotificationCount);
  recentNotifications$ = this.store.select(AppSelectors.selectRecentNotifications);
  
  totalPlayerCount$ = this.store.select(AppSelectors.selectAllPlayers).pipe(
    map(players => players.length)
  );

  currentTitle$ = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map(() => this.getRouteTitle()),
    shareReplay(1)
  );

  selectedServerId: string | null = null;

  constructor(
    private store: Store<AppState>,
    private breakpointObserver: BreakpointObserver,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialize application data
    this.store.dispatch(AppActions.loadServers());
    
    // Subscribe to selected server changes
    this.store.select(AppSelectors.selectSelectedServerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(serverId => {
        this.selectedServerId = serverId;
        if (serverId) {
          this.store.dispatch(AppActions.loadPlayers({ serverId }));
          this.store.dispatch(AppActions.loadMetrics({ serverId }));
        }
      });

    // Auto-close sidenav on mobile navigation
    this.isHandset$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(isHandset => {
      if (isHandset) {
        this.router.events.pipe(
          filter(event => event instanceof NavigationEnd),
          takeUntil(this.destroy$)
        ).subscribe(() => {
          this.store.dispatch(AppActions.toggleSidenav());
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSidenav(): void {
    this.store.dispatch(AppActions.toggleSidenav());
  }

  toggleTheme(): void {
    this.store.dispatch(AppActions.toggleDarkMode());
  }

  onServerSelect(serverId: string): void {
    this.store.dispatch(AppActions.selectServer({ serverId }));
  }

  markAsRead(notificationId: string): void {
    this.store.dispatch(AppActions.markNotificationAsRead({ id: notificationId }));
  }

  openAddServerDialog(): void {
    // TODO: Implement add server dialog component
    console.log('Add server dialog - to be implemented');
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

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'notifications';
    }
  }

  private getRouteTitle(): string {
    let route = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.snapshot.data['title'] || 'DayZ Server Manager';
  }
}
