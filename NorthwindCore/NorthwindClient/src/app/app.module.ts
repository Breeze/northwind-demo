import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { config, NamingConvention } from 'breeze-client';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';
import { AjaxHttpClientAdapter } from 'breeze-bridge2-angular';
import { CustomerComponent } from './customer/customer.component';

@NgModule({
  declarations: [
    AppComponent,
    CustomerComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(http: HttpClient) {
    // Configure Breeze adapters
    ModelLibraryBackingStoreAdapter.register();
    UriBuilderJsonAdapter.register();
    config.registerAdapter('ajax', function() { return new AjaxHttpClientAdapter(http); } as any);
    config.initializeAdapterInstance('ajax', AjaxHttpClientAdapter.adapterName, true);
    DataServiceWebApiAdapter.register();
    NamingConvention.camelCase.setAsDefault();
    config.initializeAdapterInstance('uriBuilder', 'json');
  }
}
