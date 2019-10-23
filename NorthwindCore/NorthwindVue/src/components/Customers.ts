import { Component, Prop, Vue } from "vue-property-decorator";
import { EntityManager, EntityQuery } from "breeze-client";
import { Customer } from "@/model/customer";
import { entityManagerProvider } from "@/model/entity-manager-provider";
import { Order } from "@/model/order";

@Component
export default class Customers extends Vue {
  customers: Customer[] = [];
  selected: Customer | null = null;
  manager?: EntityManager;

  // tslint:disable: typedef
  created() {
    console.log(process.env.VUE_APP_BREEZE_API);
    this.manager = entityManagerProvider.newManager();
    const query = new EntityQuery("Customers").where("lastName", "startsWith", "C").expand("orders");
    this.manager.executeQuery(query).then(qr => {
      this.customers = qr.results;
    }).catch(err => {
      console.log(err);
    });
  }

  select(cust: Customer) {
    this.selected = cust;
  }

  addCustomer() {
    this.selected = this.manager.createEntity(Customer.prototype.entityType) as Customer;
    this.customers.push(this.selected);
  }

  remove(ent: Customer | Order) {
    ent.entityAspect.setDeleted();
  }

  saveChanges() {
    this.manager.saveChanges().then(() => {
      // refresh customer list to remove deleted customers
      this.customers = this.manager.getEntities("Customer") as Customer[];
    });
  }

  rejectChanges() {
    this.manager.rejectChanges();
    this.customers = this.manager.getEntities("Customer") as Customer[];
  }
}