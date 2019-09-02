import { Component, OnInit } from '@angular/core';
import { EntityManager, EntityQuery } from 'breeze-client';
import { Customer } from '../model/customer';
import { EntityManagerProvider } from '../entity-manager-provider';

@Component({
  selector: 'app-customer',
  templateUrl: './customer.component.html',
  styleUrls: ['./customer.component.css']
})
export class CustomerComponent implements OnInit {

  manager: EntityManager;
  customers: Customer[];
  selected: Customer;
  constructor(private entityManagerProvider: EntityManagerProvider) { }

  ngOnInit() {
    this.manager = this.entityManagerProvider.newManager();
    const query = new EntityQuery('Customers').where('lastName', 'startsWith', 'C');
    this.manager.executeQuery(query).then(qr => {
      this.customers = qr.results;
    });
  }

  addCustomer() {
    this.selected = this.manager.createEntity(Customer.prototype.entityType) as Customer;
    this.customers.push(this.selected);
  }

  delete(cust: Customer) {
    cust.entityAspect.setDeleted();
  }

  saveChanges() {
    this.manager.saveChanges().then(() => {
      // refresh customer list to remove deleted customers
      this.customers = this.manager.getEntities('Customer') as Customer[];
    });
  }

  rejectChanges() {
    this.manager.rejectChanges();
    this.customers = this.manager.getEntities('Customer') as Customer[];
  }

}
