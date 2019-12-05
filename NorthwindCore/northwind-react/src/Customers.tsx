import React from 'react';
import { EntityManager, EntityQuery } from 'breeze-client';
import { Customer } from './model/customer';
import { entityManagerProvider } from './model/entity-manager-provider';

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
  
  componentDidMount() {
    entityManagerProvider.subscribeComponent(this.manager, this);

    const query = new EntityQuery("Customers").where("lastName", "startsWith", "C").expand("orders");
    this.manager.executeQuery(query).then(qr => {
      this.setState({
        selected: null,
        customers: qr.results
      });
    });
  }

  componentWillUnmount() {
    entityManagerProvider.unsubscribeComponent(this.manager, this);
  }

  addCustomer() {
    let cust = this.manager.createEntity(Customer.prototype.entityType) as Customer;
    // select the new customer, and add it to the list of customers
    this.setState({
      selected: cust,
      customers: this.state.customers.concat([cust])
    })
  }

  remove(ent: Customer) {
    ent.entityAspect.setDeleted();
  }

  saveChanges() {
    this.manager.saveChanges().then(() => {
      // refresh customer list to remove deleted customers
      this.setState({
        selected: null,
        customers: this.manager.getEntities("Customer") as Customer[]
      })
    });
  }

  rejectChanges() {
    this.manager.rejectChanges();
    // refresh customer list to restore original state
    this.setState({
      selected: null,
      customers: this.manager.getEntities("Customer") as Customer[]
    })
  }

  renderCustEdit() {
    let cust = this.state.selected;
    if (cust) {
      return <div><h3>Edit</h3>
        <div>First Name: <input type="text" name="firstName" value={cust.firstName || ''} onChange={cust.handleChange} /></div>
        <div>Last Name: <input type="text" name="lastName" value={cust.lastName || ''} onChange={cust.handleChange} /></div>
        <div>City: <input type="text" name="city" value={cust.city || ''} onChange={cust.handleChange} /></div>
        <div>Country: <input type="text" name="country" value={cust.country || ''} onChange={cust.handleChange} /></div>
        <div>Phone: <input type="text" name="phone" value={cust.phone || ''} onChange={cust.handleChange} /></div>
        <button type="button" onClick={this.remove.bind(this, cust)}>Delete</button>
      </div>
    }
  }

  render() {
    return (
      <div>
        <h1>Customers</h1>

        <table style={{margin: 'auto'}}>
          <tbody>
            {this.state.customers.map(cust =>
             <tr key={cust.id} 
             style={{backgroundColor: (cust === this.state.selected) ? 'lightgray' : 'white'}}
             onClick={() => this.setState({ selected: cust })}>
              <td>{cust.firstName} {cust.lastName}</td>
              <td>{cust.entityAspect.entityState.name}</td>
            </tr>)
            }
          </tbody>
        </table>
        <button type="button" onClick={this.addCustomer}>Add Customer</button>

        {this.renderCustEdit()}

        <div style={{marginTop: '20px'}}>
          <button type="button" disabled={!this.manager.hasChanges()} onClick={this.saveChanges}>Save Changes</button>
          <button type="button" disabled={!this.manager.hasChanges()} onClick={this.rejectChanges}>Revert Changes</button>
        </div>

      </div>
    );
  }
}
