import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { MarketSession } from './domains/market';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Приложение стартует с настройками по умолчанию, независимо от открытой страницы.
    provideAppInitializer(() => inject(MarketSession).start()),
  ],
};
