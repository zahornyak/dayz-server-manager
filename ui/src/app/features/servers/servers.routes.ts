import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./servers.component').then(m => m.ServersComponent),
    data: { title: 'Server Management' }
  }
];