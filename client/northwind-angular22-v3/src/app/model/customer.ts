// @generated-by generate-entity-classes v1.1.0
// Properties of this type in the server metadata are written here and rewritten on
// every run. Everything else in this file is yours and is never touched.
// To keep one of those too, see the manual markers in ./README.md.

import type { RelationArray } from 'breeze-client'; // @generated
import { EntityBase } from 'breeze-client'; // @generated
import type { Order } from './order'; // @generated

/**
 * Customer:#NorthwindModel.Models - the entity type, queried as `Customers`.
 * Key: id.
 *
 * Methods, getters and unmapped properties added below survive a regeneration; see
 * ./README.md.
 */
export class Customer extends EntityBase {
  declare id: number;  // @generated
  declare city: string;  // @generated
  declare country: string;  // @generated
  declare firstName: string;  // @generated
  declare lastName: string;  // @generated
  declare phone: string;  // @generated
  declare orders: RelationArray<Order>;  // @generated
}
