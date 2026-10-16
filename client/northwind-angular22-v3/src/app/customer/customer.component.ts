import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EntityQuery } from 'breeze-client';
import { Customer } from '../model/customer';
import { EntityManagerProvider } from '../entity-manager-provider';

@Component({
  selector: 'app-customer',
  imports: [FormsModule],
  templateUrl: './customer.component.html',
  styleUrl: './customer.component.css',
})
export class CustomerComponent implements OnInit {

  // The app is zoneless, so the view state is held in signals; updating them
  // is what tells Angular to re-render after a query or save completes.
  readonly manager = inject(EntityManagerProvider).newManager();
  readonly customers = signal<Customer[]>([]);
  readonly selected = signal<Customer | undefined>(undefined);

  ngOnInit() {
    const query = new EntityQuery('Customers').where('lastName', 'startsWith', 'C');
    this.manager.executeQuery(query).then(qr => {
      this.customers.set(qr.results);
    });
  }

  addCustomer() {
    const cust = this.manager.createEntity(Customer.prototype.entityType) as Customer;
    this.selected.set(cust);
    this.customers.update(customers => [...customers, cust]);
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

}
