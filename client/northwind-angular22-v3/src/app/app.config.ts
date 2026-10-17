import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { ConfirmationService } from '@openng/optimus-ui/api';
import { provideOptimus } from '@openng/optimus-ui/config';
import Aura from '@openng/optimus-ui-themes/aura';
import { httpClientFetch } from 'breeze-client/adapter-angular-httpclient';
import { configureBreeze } from 'breeze-client';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideOptimus({ theme: { preset: Aura } }),
    // Used to open the p-confirmdialog in app.html
    ConfirmationService,
    // Configure Breeze adapters before anything creates an EntityManager.
    // This is the standalone equivalent of the AppModule constructor.
    provideAppInitializer(() => {
      const http = inject(HttpClient);
      configureBreeze({ fetch: httpClientFetch(http) });      
    }),
  ],
};
