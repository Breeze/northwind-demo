// tslint:disable:no-trailing-whitespace
// tslint:disable:member-ordering
import { BaseEntity } from './base-entity';
import { Product } from './product';

/// <code-import> Place custom imports between <code-import> tags

/// </code-import>

export class Supplier extends BaseEntity  {

  /// <code> Place custom code between <code> tags
  
  /// </code>

  // Generated code. Do not place code below this line.
  id: number;
  city: string;
  companyName: string;
  contactName: string;
  contactTitle: string;
  country: string;
  fax: string;
  phone: string;
  products: Product[];
}

