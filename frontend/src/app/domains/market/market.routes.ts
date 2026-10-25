import { Routes } from '@angular/router';

// Страницы домена «рынок». Компоненты загружаются лениво: каждая страница отдельным бандлом.
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
