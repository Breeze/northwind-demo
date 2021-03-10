import { MetadataStore } from 'breeze-client';

import { Customer } from './customer';
import { Order } from './order';
import { OrderItem } from './order-item';
import { Product } from './product';
import { Supplier } from './supplier';

export class NorthwindRegistrationHelper {

    static register(metadataStore: MetadataStore) {
        metadataStore.registerEntityTypeCtor('Customer', Customer);
        metadataStore.registerEntityTypeCtor('Order', Order);
        metadataStore.registerEntityTypeCtor('OrderItem', OrderItem);
        metadataStore.registerEntityTypeCtor('Product', Product);
        metadataStore.registerEntityTypeCtor('Supplier', Supplier);
    }
}
