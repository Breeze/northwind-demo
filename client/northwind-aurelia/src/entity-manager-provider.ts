import { DI } from "aurelia";
import { DataService, EntityManager, NamingConvention } from "breeze-client";
import { AjaxFetchAdapter } from "breeze-client/adapter-ajax-fetch";
import { DataServiceWebApiAdapter } from "breeze-client/adapter-data-service-webapi";
import { ModelLibraryBackingStoreAdapter } from "breeze-client/adapter-model-library-backing-store";
import { UriBuilderJsonAdapter } from "breeze-client/adapter-uri-builder-json";
import { NorthwindMetadata } from "./model/metadata";
import { NorthwindRegistrationHelper } from "./model/registration-helper";

export class EntityManagerProvider {

  protected masterManager: EntityManager;

  constructor() {
    // configure breeze adapters
    ModelLibraryBackingStoreAdapter.register();
    UriBuilderJsonAdapter.register();
    AjaxFetchAdapter.register();
    DataServiceWebApiAdapter.register();
    NamingConvention.camelCase.setAsDefault();

    // configure API endpoint
    const dataService = new DataService({
      serviceName: "http://localhost:4000/api/breeze",
      hasServerMetadata: false
    });

    // register entity metadata
    this.masterManager = new EntityManager({ dataService });
    const metadataStore = this.masterManager.metadataStore;
    metadataStore.importMetadata(NorthwindMetadata.value);
    NorthwindRegistrationHelper.register(metadataStore);
  }

  /** Return empty manager configured with dataservice and metadata */
  newManager(): EntityManager {
    return this.masterManager.createEmptyCopy();
  }
}

// Register as singleton with Dependency Injection
DI.singleton(EntityManagerProvider);
