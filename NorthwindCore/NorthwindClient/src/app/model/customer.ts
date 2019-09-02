// tslint:disable:no-trailing-whitespace
// tslint:disable:member-ordering
import { BaseEntity } from './base-entity';
import { Order } from './order';

/// <code-import> Place custom imports between <code-import> tags

/// </code-import>

export class Customer extends BaseEntity  {

  /// <code> Place custom code between <code> tags
  
  /// </code>

  // Generated code. Do not place code below this line.
  id: number;
  city: string;
  country: string;
  firstName: string;
  lastName: string;
  phone: string;
  orders: Order[];
}

