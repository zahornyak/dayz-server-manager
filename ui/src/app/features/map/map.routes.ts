import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: '', loadComponent: () => import('./map.component').then(m => m.MapComponent), data: { title: 'Live Map' } }
];