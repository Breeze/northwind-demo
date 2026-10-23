import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { IftaLabelModule } from '@openng/optimus-ui/iftalabel';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { PanelModule } from '@openng/optimus-ui/panel';
import { TableLazyLoadEvent, TableModule } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';
import { EntityQuery, EntityState, Predicate } from 'breeze-client';
import { Customer } from '../model/customer';
import { Order } from '../model/order';
import { EntityManagerProvider } from '../entity-manager-provider';
import { HasUnsavedChanges } from '../unsaved-changes.guard';

@Component({
  selector: 'app-customer',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, ButtonModule, IconFieldModule, IftaLabelModule, InputIconModule, InputTextModule, PanelModule, TableModule, TagModule],
  templateUrl: './customer.component.html',
  styleUrl: './customer.component.css',
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class CustomerComponent implements HasUnsavedChanges {

  // The app is zoneless, so the view state is held in signals; updating them
  // is what tells Angular to re-render after a query or save completes.
  readonly manager = inject(EntityManagerProvider).newManager();
  readonly customers = signal<Customer[]>([]);
  readonly selected = signal<Customer | undefined>(undefined);
  readonly orders = signal<Order[]>([]);
  readonly ordersLoading = signal(false);

  // Paging state for the customer table
  readonly first = signal(0);
  readonly rows = signal(10);
  readonly totalRecords = signal(0);
  readonly customersLoading = signal(false);
  private pageRequest = 0;

  // Sorting and filtering state for the customer table
  readonly sortField = signal('lastName');
  readonly sortOrder = signal(1);  // 1 = ascending, -1 = descending
  readonly searchText = signal('');

  // Called by the table when it first displays, and whenever the user changes the page,
  // the page size, the sort column, or the search text
  loadPage(event: TableLazyLoadEvent) {
    this.first.set(event.first ?? 0);
    this.rows.set(event.rows ?? this.rows());
    this.sortField.set(typeof event.sortField === 'string' ? event.sortField : 'lastName');
    this.sortOrder.set(event.sortOrder ?? 1);
    this.searchText.set(typeof event.globalFilter === 'string' ? event.globalFilter.trim() : '');
    this.queryCustomers();
  }

  // Query one page of customers, and the total number of matching customers for the paginator
  private queryCustomers() {
    const request = ++this.pageRequest;
    const query = this.sortQuery(new EntityQuery('Customers'))
      .where(this.searchPredicate())
      .skip(this.first())
      .take(this.rows())
      .inlineCount();
    this.customersLoading.set(true);
    this.manager.executeQuery(query).then(qr => {
      if (request !== this.pageRequest) {
        return; // the user has already asked for another page
      }
      const total = qr.inlineCount ?? 0;
      if (qr.results.length === 0 && this.first() > 0 && total > 0) {
        // The page is past the end, e.g. after deleting the last customers; show the last page instead
        this.first.set(Math.floor((total - 1) / this.rows()) * this.rows());
        this.queryCustomers();
        return;
      }
      this.totalRecords.set(total);
      // New customers aren't on the server yet, so show them at the top of every page until they are saved
      this.customers.set([...this.addedCustomers(), ...qr.results]);
    }).finally(() => {
      if (request === this.pageRequest) {
        this.customersLoading.set(false);
      }
    });
  }

  // Sort by the chosen column, then by name and id, so that every customer has a fixed
  // place in the order and pages never overlap or skip anyone
  private sortQuery(query: EntityQuery) {
    const descending = this.sortOrder() === -1;
    const byName = ['lastName', 'firstName', 'id'];
    const field = this.sortField();
    return field === 'lastName'
      ? query.orderBy(byName, descending)
      : query.orderBy(field, descending).orderBy(byName);
  }

  // Each word of the search text must appear in the first name, last name, city or country
  private searchPredicate() {
    const words = this.searchText().split(/\s+/).filter(w => w);
    if (words.length === 0) {
      return undefined;
    }
    const fields = ['firstName', 'lastName', 'city', 'country'];
    return Predicate.and(words.map(word =>
      Predicate.or(fields.map(field => Predicate.create(field, 'contains', word)))));
  }

  private addedCustomers() {
    return this.manager.getEntities('Customer', EntityState.Added) as Customer[];
  }

  addCustomer() {
    const cust = this.manager.createEntity(Customer.prototype.entityType) as Customer;
    this.select(cust);
    this.customers.update(customers => [cust, ...customers]);
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
      this.deselectIfDetached();
      // re-query the page, since saved customers now have their place in the sort order,
      // and deleted customers are gone
      this.queryCustomers();
    });
  }

  rejectChanges() {
    this.manager.rejectChanges();
    this.deselectIfDetached();
    // rejecting removes new customers from the cache; the rest of the page is still correct
    this.customers.update(customers => customers.filter(c => !c.entityAspect.entityState.isDetached()));
  }

  // A deleted customer that has been saved, or a new customer that has been rejected,
  // is no longer in the cache, so it can't stay selected
  private deselectIfDetached() {
    if (this.selected()?.entityAspect.entityState.isDetached()) {
      this.select(undefined);
    }
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
