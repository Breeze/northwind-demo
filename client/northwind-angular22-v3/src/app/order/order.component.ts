import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';
import { PanelModule } from '@openng/optimus-ui/panel';
import { TableModule } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';
import { EntityQuery } from 'breeze-client';
import { Order } from '../model/order';
import { OrderItem } from '../model/order-item';
import { EntityManagerProvider } from '../entity-manager-provider';

@Component({
  selector: 'app-order',
  imports: [CurrencyPipe, DatePipe, RouterLink, ButtonModule, PanelModule, TableModule, TagModule],
  templateUrl: './order.component.html',
  styleUrl: './order.component.css',
})
export class OrderComponent implements OnInit {

  /** The order id, bound from the `orders/:id` route parameter. */
  readonly id = input.required<string>();

  readonly manager = inject(EntityManagerProvider).newManager();
  readonly order = signal<Order | undefined>(undefined);
  readonly orderItems = signal<OrderItem[]>([]);
  readonly loading = signal(true);

  ngOnInit() {
    // Get the order, its customer, and its items with their products and suppliers, in one query
    const query = new EntityQuery('Orders')
      .where('id', '==', Number(this.id()))
      .expand('customer, orderItems.product.supplier');
    this.manager.executeQuery(query).then(qr => {
      const order = qr.results[0] as Order | undefined;
      this.order.set(order);
      this.orderItems.set(order ? [...order.orderItems] : []);
    }).finally(() => {
      this.loading.set(false);
    });
  }

  lineTotal(item: OrderItem) {
    return item.unitPrice * item.quantity;
  }
}
