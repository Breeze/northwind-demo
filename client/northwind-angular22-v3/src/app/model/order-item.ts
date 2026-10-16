// @generated-by generate-entity-classes v1.1.0
// Properties of this type in the server metadata are written here and rewritten on
// every run. Everything else in this file is yours and is never touched.
// To keep one of those too, see the manual markers in ./README.md.

import { EntityBase } from 'breeze-client'; // @generated
import type { Order } from './order'; // @generated
import type { Product } from './product'; // @generated

/**
 * OrderItem:#NorthwindModel.Models - the entity type, queried as `OrderItems`.
 * Key: id.
 *
 * Methods, getters and unmapped properties added below survive a regeneration; see
 * ./README.md.
 */
export class OrderItem extends EntityBase {
  declare id: number;  // @generated
  declare orderId: number;  // @generated
  declare productId: number;  // @generated
  declare quantity: number;  // @generated
  declare unitPrice: number;  // @generated
  declare order: Order;  // @generated
  declare product: Product;  // @generated
}
