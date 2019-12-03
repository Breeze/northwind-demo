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
  }
  
  componentDidMount() {
    entityManagerProvider.subscribeComponent(this.manager, this);

    const query = new EntityQuery("Customers").where("lastName", "startsWith", "C").expand("orders");
    this.manager.executeQuery(query).then(qr => {
      this.setState({
        customers: qr.results
      });
    });
  }

  componentWillUnmount() {
    entityManagerProvider.unsubscribeComponent(this.manager, this);
  }

  render() {
    return (
      <div>
        <h1>Customers</h1>

        <table>
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
      </div>
    );
  }
}
