import { DataService, EntityManager, NamingConvention } from "breeze-client";
import { AjaxFetchAdapter } from "breeze-client/adapter-ajax-fetch";
import { DataServiceWebApiAdapter } from "breeze-client/adapter-data-service-webapi";
import { ModelLibraryBackingStoreAdapter } from "breeze-client/adapter-model-library-backing-store";
import { UriBuilderJsonAdapter } from "breeze-client/adapter-uri-builder-json";

import { NorthwindMetadata } from "./metadata";
import { NorthwindRegistrationHelper } from "./registration-helper";

export class EntityManagerProvider {

  protected masterManager: EntityManager;

  constructor() {

    ModelLibraryBackingStoreAdapter.register();
    UriBuilderJsonAdapter.register();
    AjaxFetchAdapter.register();
    DataServiceWebApiAdapter.register();
    NamingConvention.camelCase.setAsDefault();

    const dataService = new DataService({
      serviceName: process.env.VUE_APP_BREEZE_API,
      hasServerMetadata: false
    });

    this.masterManager = new EntityManager({ dataService });
    const metadataStore = this.masterManager.metadataStore;
    metadataStore.importMetadata(NorthwindMetadata.value);
    NorthwindRegistrationHelper.register(metadataStore);
  }

  newManager(): EntityManager {
    return this.masterManager.createEmptyCopy();
  }
}

export const entityManagerProvider = new EntityManagerProvider();
