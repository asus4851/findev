import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard · Realtime Market',
    loadComponent: () => import('./market/pages/dashboard/dashboard.component').then((m) => m.Dashboard),
  },
  {
    path: 'settings',
    title: 'Settings · Realtime Market',
    loadComponent: () => import('./market/pages/settings/settings.component').then((m) => m.Settings),
  },
  { path: '**', redirectTo: 'dashboard' },
];
