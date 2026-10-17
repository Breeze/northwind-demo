import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';
import { IftaLabelModule } from '@openng/optimus-ui/iftalabel';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { PanelModule } from '@openng/optimus-ui/panel';
import { TableModule } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';
import { EntityQuery } from 'breeze-client';
import { Customer } from '../model/customer';
import { Order } from '../model/order';
import { EntityManagerProvider } from '../entity-manager-provider';
import { HasUnsavedChanges } from '../unsaved-changes.guard';

@Component({
  selector: 'app-customer',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, ButtonModule, IftaLabelModule, InputTextModule, PanelModule, TableModule, TagModule],
  templateUrl: './customer.component.html',
  styleUrl: './customer.component.css',
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class CustomerComponent implements OnInit, HasUnsavedChanges {

  // The app is zoneless, so the view state is held in signals; updating them
  // is what tells Angular to re-render after a query or save completes.
  readonly manager = inject(EntityManagerProvider).newManager();
  readonly customers = signal<Customer[]>([]);
  readonly selected = signal<Customer | undefined>(undefined);
  readonly orders = signal<Order[]>([]);
  readonly ordersLoading = signal(false);

  ngOnInit() {
    const query = new EntityQuery('Customers').where('lastName', 'startsWith', 'C');
    this.manager.executeQuery(query).then(qr => {
      this.customers.set(qr.results);
    });
  }

  addCustomer() {
    const cust = this.manager.createEntity(Customer.prototype.entityType) as Customer;
    this.select(cust);
    this.customers.update(customers => [...customers, cust]);
  }

  select(cust: Customer | undefined) {
    this.selected.set(cust);
    this.loadOrders(cust);
  }

  // Show the customer's orders.  They are queried from the server the first time
  // the customer is selected; after that, Breeze has them in its cache.
  private loadOrders(cust: Customer | undefined) {
    this.ordersLoading.set(false);
    if (!cust) {
      this.orders.set([]);
      return;
    }
    const aspect = cust.entityAspect;
    if (aspect.entityState.isAdded() || aspect.isNavigationPropertyLoaded('orders')) {
      this.orders.set([...cust.orders]);
      return;
    }
    this.orders.set([]);
    this.ordersLoading.set(true);
    aspect.loadNavigationProperty('orders').finally(() => {
      // ignore the result if another customer was selected in the meantime
      if (this.selected() === cust) {
        this.orders.set([...cust.orders]);
        this.ordersLoading.set(false);
      }
    });
  }

  delete(cust: Customer) {
    cust.entityAspect.setDeleted();
  }

  saveChanges() {
    this.manager.saveChanges().then(() => {
      // refresh customer list to remove deleted customers
      this.customers.set(this.manager.getEntities('Customer') as Customer[]);
    });
  }

  rejectChanges() {
    this.manager.rejectChanges();
    this.customers.set(this.manager.getEntities('Customer') as Customer[]);
  }

  // Checked by unsavedChangesGuard before the router leaves this page
  hasUnsavedChanges() {
    return this.manager.hasChanges();
  }

  // The router can't stop the browser from reloading or closing the tab, so ask
  // the browser to show its own "leave site?" prompt instead.
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  canDelete() {
    const cust = this.selected();
    return !!cust && !cust.entityAspect.entityState.isDeleted();
  }

  ordersHeader() {
    const cust = this.selected();
    return cust ? `Orders for ${cust.firstName ?? ''} ${cust.lastName ?? ''}` : 'Orders';
  }

  // Color for the entity state tag in the customer list
  stateSeverity(cust: Customer) {
    const state = cust.entityAspect.entityState;
    if (state.isAdded()) return 'success';
    if (state.isModified()) return 'warn';
    if (state.isDeleted()) return 'danger';
    return 'secondary';
  }

}
