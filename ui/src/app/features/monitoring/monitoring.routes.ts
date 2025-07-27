import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: '', loadComponent: () => import('./monitoring.component').then(m => m.MonitoringComponent), data: { title: 'Server Monitoring' } }
];