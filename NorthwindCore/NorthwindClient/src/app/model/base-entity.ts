import { Entity, EntityAspect, EntityType } from 'breeze-client';

export class BaseEntity implements Entity {
  entityAspect: EntityAspect;
  entityType: EntityType;
}
