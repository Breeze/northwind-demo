// tslint:disable:no-trailing-whitespace
// tslint:disable:member-ordering
import { BaseEntity } from './base-entity';
import { Order } from './order';
import { Product } from './product';

/// <code-import> Place custom imports between <code-import> tags

/// </code-import>

export class OrderItem extends BaseEntity  {

  /// <code> Place custom code between <code> tags
  
  /// </code>

  // Generated code. Do not place code below this line.
  id: number;
  orderId: number;
  productId: number;
  unitPrice: number;
  quantity: number;
  order: Order;
  product: Product;
}

