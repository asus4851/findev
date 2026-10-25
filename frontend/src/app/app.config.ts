import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { MarketSession } from './domains/market/services/market-session.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Застосунок стартує з налаштуваннями за замовчуванням, незалежно від відкритої сторінки.
    provideAppInitializer(() => inject(MarketSession).start()),
  ],
};
