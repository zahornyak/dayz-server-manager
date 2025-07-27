import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.routes),
    data: { title: 'Dashboard' }
  },
  {
    path: 'servers',
    loadChildren: () => import('./features/servers/servers.routes').then(m => m.routes),
    data: { title: 'Server Management' }
  },
  {
    path: 'players',
    loadChildren: () => import('./features/players/players.routes').then(m => m.routes),
    data: { title: 'Player Management' }
  },
  {
    path: 'monitoring',
    loadChildren: () => import('./features/monitoring/monitoring.routes').then(m => m.routes),
    data: { title: 'Server Monitoring' }
  },
  {
    path: 'map',
    loadChildren: () => import('./features/map/map.routes').then(m => m.routes),
    data: { title: 'Live Map' }
  },
  {
    path: 'logs',
    loadChildren: () => import('./features/logs/logs.routes').then(m => m.routes),
    data: { title: 'Logs & Events' }
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/settings/settings.routes').then(m => m.routes),
    data: { title: 'Settings' }
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
