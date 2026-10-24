import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { MarketProducer } from './core/market/market-producer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Застосунок стартує з налаштуваннями за замовчуванням, незалежно від відкритої сторінки.
    provideAppInitializer(() => inject(MarketProducer).start()),
  ],
};
