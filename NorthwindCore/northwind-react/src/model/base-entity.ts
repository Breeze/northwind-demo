import { Entity, EntityAspect, EntityType } from "breeze-client";
import { ChangeEvent } from "react";

export class BaseEntity implements Entity {
  entityAspect: EntityAspect;
  entityType: EntityType;

  /** Update entity property with the value from the event */
  handleChange(event: ChangeEvent<HTMLInputElement>) {
    const target = event.target;
    const name = target.name;
    const value = (target.type === "checkbox" || target.type === "radio") ? target.checked : target.value;
    this[name] = value;
  }
  constructor() {
    this.handleChange = this.handleChange.bind(this);
  }
}