import { Routes } from '@angular/router';
import { MARKET_ROUTES } from './domains/market';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ...MARKET_ROUTES,
  { path: '**', redirectTo: 'dashboard' },
];
