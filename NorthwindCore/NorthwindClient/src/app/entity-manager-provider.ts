import { Injectable } from '@angular/core';
import { DataService, EntityManager } from 'breeze-client';
import { environment } from '../environments/environment';
import { NorthwindMetadata } from './model/metadata';
import { NorthwindRegistrationHelper } from './model/registration-helper';

@Injectable({providedIn: 'root'})
export class EntityManagerProvider {

  protected masterManager: EntityManager;

  constructor() {
    const dataService = new DataService({
      serviceName: environment.breezeApiRoot,
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
