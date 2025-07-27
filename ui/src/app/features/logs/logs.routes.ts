import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: '', loadComponent: () => import('./logs.component').then(m => m.LogsComponent), data: { title: 'Logs & Events' } }
];