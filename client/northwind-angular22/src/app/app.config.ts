import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { NamingConvention } from 'breeze-client';
import { AjaxHttpClientAdapter } from 'breeze-client/adapter-ajax-httpclient';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Configure Breeze adapters before anything creates an EntityManager.
    // This is the standalone equivalent of the AppModule constructor.
    provideAppInitializer(() => {
      const http = inject(HttpClient);
      ModelLibraryBackingStoreAdapter.register();
      UriBuilderJsonAdapter.register();
      AjaxHttpClientAdapter.register(http);
      DataServiceWebApiAdapter.register();
      NamingConvention.camelCase.setAsDefault();
    }),
  ],
};
