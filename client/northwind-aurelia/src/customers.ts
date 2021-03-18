import { inject } from "@aurelia/kernel";
import { EntityManager, EntityQuery } from "breeze-client";
import { EntityManagerProvider } from "./entity-manager-provider";
import { Customer } from "./model/customer";

@inject(EntityManagerProvider)
export class Customers {
  public customers: Customer[];
  public selected: Customer;
  private manager: EntityManager;
 
  constructor(emp: EntityManagerProvider) {
    this.manager = emp.newManager();
  }

  created() {
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

  get hasChanges() {
    return this.manager.hasChanges();
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
