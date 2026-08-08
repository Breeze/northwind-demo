// tslint:disable:no-trailing-whitespace
// tslint:disable:member-ordering
import { BaseEntity } from '../base-entity';
import { OrderItem } from './order-item';
import { Supplier } from './supplier';

/// <code-import> Place custom imports between <code-import> tags

/// </code-import>

/// <module-code> Place module level code between <module-code> tags

/// </module-code>

export class Product extends BaseEntity  {

  /// <code> Place custom code between <code> tags
  
  /// </code>

  // Generated code. Do not place code below this line.
  id!: number;
  isDiscontinued!: boolean;
  package?: string;
  productName!: string;
  supplierId!: number;
  unitPrice?: number;
  orderItems!: OrderItem[];
  supplier!: Supplier;
}

