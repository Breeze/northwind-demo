// @generated-by generate-entity-classes v1.1.0
// Properties of this type in the server metadata are written here and rewritten on
// every run. Everything else in this file is yours and is never touched.
// To keep one of those too, see the manual markers in ./README.md.

import type { RelationArray } from 'breeze-client'; // @generated
import { EntityBase } from 'breeze-client'; // @generated
import type { Customer } from './customer'; // @generated
import type { OrderItem } from './order-item'; // @generated

/**
 * Order:#NorthwindModel.Models - the entity type, queried as `Orders`.
 * Key: id.
 *
 * Methods, getters and unmapped properties added below survive a regeneration; see
 * ./README.md.
 */
export class Order extends EntityBase {
  declare id: number;  // @generated
  declare customerId: number;  // @generated
  declare orderDate: Date;  // @generated
  declare orderNumber: string;  // @generated
  declare totalAmount: number;  // @generated
  declare customer: Customer;  // @generated
  declare orderItems: RelationArray<OrderItem>;  // @generated
}
