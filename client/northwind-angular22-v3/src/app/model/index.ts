// @generated-by generate-entity-classes v1.1.0
// This whole file is generated. Put hand-written code in a separate module.
//
// registerModelClasses attaches these classes to one MetadataStore. Breeze binds a class to a
// single store - registering the same class in a second store throws - so call it once, on the
// store the managers under test share.
import type { MetadataStore } from 'breeze-client';
export { ComplexObjectBase, EntityBase } from 'breeze-client';
import { Customer } from './customer';
import { Order } from './order';
import { OrderItem } from './order-item';
import { Product } from './product';
import { Supplier } from './supplier';

export {
  Customer,
  Order,
  OrderItem,
  Product,
  Supplier,
};

/** Every generated class, by the short name Breeze knows it as. */
export const modelClasses = {
  Customer,
  Order,
  OrderItem,
  Product,
  Supplier,
};

/** Register all of them with `metadataStore`. Safe to call twice with the same store. */
export function registerModelClasses(metadataStore: MetadataStore) {
  for (const [name, ctor] of Object.entries(modelClasses)) {
    metadataStore.registerEntityTypeCtor(name, ctor);
  }
}
