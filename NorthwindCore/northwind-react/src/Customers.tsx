import { EntityManager, EntityQuery } from 'breeze-client';
import React from 'react';
import { Customer } from './model/customer';
import { entityManagerProvider } from './model/entity-manager-provider';
import { Order } from './model/order';

interface CustState {
  customers: Customer[];
  selected: Customer;
}
export class Customers extends React.Component<any, CustState> {

  manager: EntityManager;

  constructor(props: any) {
    super(props);
    this.state = {
      customers: [] as Customer[],
      selected: null as Customer
    };
    this.manager = entityManagerProvider.newManager();

    this.saveChanges = this.saveChanges.bind(this);
    this.rejectChanges = this.rejectChanges.bind(this);
    this.addCustomer = this.addCustomer.bind(this);
    this.remove = this.remove.bind(this);
  }

  select(cust: Customer, event: Event) {
    this.setState({
      selected: cust
    })
  }

  addCustomer() {
    let cust = this.manager.createEntity(Customer.prototype.entityType) as Customer;
    this.setState({
      selected: cust,
      customers: this.state.customers.concat([cust])
    })
  }

  remove(ent: Customer | Order) {
    ent.entityAspect.setDeleted();
  }

  saveChanges() {
    this.manager.saveChanges().then(() => {
      // refresh customer list to remove deleted customers
      this.setState({
        customers: this.manager.getEntities("Customer") as Customer[]
      })
    });
  }

  rejectChanges() {
    this.manager.rejectChanges();
    this.setState({
      customers: this.manager.getEntities("Customer") as Customer[]
    })
  }

  componentDidMount() {
    entityManagerProvider.subscribeComponent(this.manager, this);

    const query = new EntityQuery("Customers").where("lastName", "startsWith", "C").expand("orders");
    this.manager.executeQuery(query).then(qr => {
      this.setState({
        customers: qr.results
      });
    }).catch(err => {
      console.log(err);
    });
  }

  componentWillUnmount() {
    entityManagerProvider.unsubscribeComponent(this.manager, this);
  }

  renderCustRows() {
    return this.state.customers.map(cust => {
      let bgstyle = { backgroundColor: (cust === this.state.selected) ? 'lightgray' : 'white' };
      return <tr key={cust.id} style={bgstyle} onClick={this.select.bind(this, cust)}>
        <td>{cust.firstName} {cust.lastName}</td>
        <td>{cust.entityAspect.entityState.name}</td>
      </tr>
    });
  }

  renderCustEdit() {
    let cust = this.state.selected;
    if (cust) {
      return <div><h3>Edit</h3>
        <div>First Name: <input type="text" name="firstName" value={cust.firstName} onChange={cust.handleChange} /></div>
        <div>Last Name: <input type="text" name="lastName" value={cust.lastName} onChange={cust.handleChange} /></div>
        <div>City: <input type="text" name="city" value={cust.city} onChange={cust.handleChange} /></div>
        <div>Country: <input type="text" name="country" value={cust.country} onChange={cust.handleChange} /></div>
        <div>Phone: <input type="text" name="phone" value={cust.phone} onChange={cust.handleChange} /></div>
        <button type="button" onClick={this.remove.bind(this, cust)}>Delete</button>

        <table><tbody>
          {cust.orders.map(o => {
            return <tr key={o.id}>
              <td>{o.orderNumber}</td>
              <td>{o.totalAmount}</td>
              <td>{o.orderDate.toDateString()}</td>
              <td><button type="button" onClick={this.remove.bind(this, o)}>Delete</button></td>
            </tr>
          })}
        </tbody>
        </table>
      </div>
    }
  }

  render() {
    return (
      <div>
        <p>Customer works!</p>
        <table>
          <tbody>
            {this.renderCustRows()}
          </tbody>
        </table>

        {this.renderCustEdit()}

        {this.manager.hasChanges() && <div>
          <button type="button" onClick={this.saveChanges}>Save Changes</button>
          <button type="button" onClick={this.rejectChanges}>Revert Changes</button>
        </div>
        }
      </div>
    );
  }
}
