import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: '', loadComponent: () => import('./players.component').then(m => m.PlayersComponent), data: { title: 'Player Management' } }
];