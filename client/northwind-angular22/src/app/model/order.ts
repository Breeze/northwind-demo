// tslint:disable:no-trailing-whitespace
// tslint:disable:member-ordering
import { BaseEntity } from '../base-entity';
import { Customer } from './customer';
import { OrderItem } from './order-item';

/// <code-import> Place custom imports between <code-import> tags

/// </code-import>

/// <module-code> Place module level code between <module-code> tags

/// </module-code>

export class Order extends BaseEntity  {

  /// <code> Place custom code between <code> tags
  
  /// </code>

  // Generated code. Do not place code below this line.
  id!: number;
  customerId!: number;
  orderDate!: Date;
  orderNumber?: string;
  totalAmount?: number;
  customer!: Customer;
  orderItems!: OrderItem[];
}

