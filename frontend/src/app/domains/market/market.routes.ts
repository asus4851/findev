import { Routes } from '@angular/router';

// Сторінки домену «ринок». Компоненти завантажуються ліниво: кожна сторінка окремим бандлом.
export const MARKET_ROUTES: Routes = [
  {
    path: 'dashboard',
    title: 'Dashboard · Realtime Market',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.Dashboard),
  },
  {
    path: 'settings',
    title: 'Settings · Realtime Market',
    loadComponent: () => import('./pages/settings/settings.component').then((m) => m.Settings),
  },
];
