# Steps for creating a Breeze React App

Here we are going to create a new [React](https://reactjs.org/) application, using Breeze to handle the data management.

We will assume that you've already got the server side created, following the outline described in the [STEPS](../STEPS.md) document.

For the client, we will start with an empty directory and build an application that
talks to the server, using Breeze to query and update data.

Along the way we will:

- Create a React application using the CLI
- Create TypeScript entity classes from the server metadata
- Create a React component to read and update entities

# Create the React App

To create the initial shell of the React app, we will use the React CLI as instructed in the [React docs](https://reactjs.org/docs/create-a-new-react-app.html#create-react-app).

First, make sure you have [nodejs](https://nodejs.org) and [npm](https://docs.npmjs.com/) installed.

Next, open a command prompt in the `client` directory, and follow the steps below:

1. `npx create-react-app northwind-react --typescript --use-npm`

Now you should have a `client/northwind-react` directory containing the React app.  Try it out:

`cd northwind-react`
`npm start`

This will compile the app and open a browser on http://localhost:3000 with a welcome page.  

You can learn more about the app structure in the [Create React App documentation](https://create-react-app.dev/docs/getting-started).

Stop the server from the command line using Ctrl-C.

## Add Breeze packages

Now we'll add Breeze to the app, so we can query entities from the server and update them.

Start by adding the npm packages.  In the `northwind-react` directory, run:

`npm install breeze-client breeze-entity-generator`

## Generate Entities

When developing our app, it's helpful to have TypeScript classes to represent the entity data that comes from the server.  The data is in the form of Breeze entities, so we will first create a base class to represent that.

#### Create the base class

In the `northwind-react/src` directory, create a new directory, `model`.  

Then, in `northwind-react/src/model`, create a new TypeScript file, `base-entity.ts`.  Populate the file with:
```
import { Entity, EntityAspect, EntityType } from "breeze-client";
import { ChangeEvent } from "react";

export class BaseEntity implements Entity {
  entityAspect: EntityAspect;
  entityType: EntityType;

  /** Update entity property with the value from the event */
  handleChange(event: ChangeEvent<HTMLInputElement>) {
    const target = event.target;
    const name = target.name;
    const value = (target.type === "checkbox" || target.type === "radio") ? target.checked : target.value;
    this[name] = value;
  }
  constructor() {
    this.handleChange = this.handleChange.bind(this);
  }
}
```
The `handleChange` method sets property values in the entity based on input changes.  It will be called from our editing component.

When we generate the entities, we will tell the entity generator to use this base class.

#### Generate metadata from server

You should already have a `metadata.json` file in the [server](../server) directory. 
If you don't, see the "Generate the metadata" topic in the STEPS document for your server.

#### Generate entities from metadata
To turn the metadata into entities, we need to write a script.  In the `northwind-react` directory,
create a file called `generate-entities.js`.

Fill `generate-entities.js` with the following:
```
const tsGen = require('breeze-entity-generator/tsgen-core');
const fs = require('fs');
const dir = './src/model';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

tsGen.generate({
  inputFileName: '../../server/metadata.json',
  outputFolder: dir,
  camelCase: true,
  baseClassName: 'BaseEntity',
  kebabCaseFileNames: true,
  codePrefix: 'Northwind'
});
```
Then run the file with

`node generate-entities.js`

This should create files in the `northwind-react/src/model` directory:
```
customer.ts
entity-model.ts
metadata.ts
order-item.ts
order.ts
product.ts
registration-helper.ts
supplier.ts
```
These are the entity classes, plus the metadata and the registration-helper that we will use later.

_Note that you can customize the entity output by changing the parameters to the `generate` function, 
and by changing the template files.  See `node_modules/breeze-entity-generator/README.md` for more information._

## Create the EntityManagerProvider

In a Breeze application, the [EntityManager](http://breeze.github.io/doc-js/entitymanager-and-caching.html) caches the
entities and keeps track of the changes.  You may need more than one, if you want to keep multiple change sets.  To make
it easy, we will create a service called the EntityManagerProvider.

_For simplicity, we'll put this in the `model` folder that we created above.  In a real project, you might want to create
a separate subdirectory for services._

Create the file `northwind-react/src/model/entity-manager-provider.ts`.  In the file, put:
```
import { DataService, EntityManager, NamingConvention, EntityAction } from "breeze-client";
import { AjaxFetchAdapter } from "breeze-client/adapter-ajax-fetch";
import { DataServiceWebApiAdapter } from "breeze-client/adapter-data-service-webapi";
import { ModelLibraryBackingStoreAdapter } from "breeze-client/adapter-model-library-backing-store";
import { UriBuilderJsonAdapter } from "breeze-client/adapter-uri-builder-json";

import { NorthwindMetadata } from "./metadata";
import { NorthwindRegistrationHelper } from "./registration-helper";

export class EntityManagerProvider {

  protected masterManager: EntityManager;

  constructor() {
    // configure breeze adapters
    ModelLibraryBackingStoreAdapter.register();
    UriBuilderJsonAdapter.register();
    AjaxFetchAdapter.register();
    DataServiceWebApiAdapter.register();
    NamingConvention.camelCase.setAsDefault();

    // configure API endpoint
    const dataService = new DataService({
      serviceName: "http://localhost:4000/api/breeze",
      hasServerMetadata: false
    });

    // register entity metadata
    this.masterManager = new EntityManager({ dataService });
    const metadataStore = this.masterManager.metadataStore;
    metadataStore.importMetadata(NorthwindMetadata.value);
    NorthwindRegistrationHelper.register(metadataStore);
  }

  /** Return empty manager configured with dataservice and metadata */
  newManager(): EntityManager {
    return this.masterManager.createEmptyCopy();
  }

  /** Call forceUpdate() on the component when an entity property or state changes */
  subscribeComponent(manager: EntityManager, component: { forceUpdate: () => void }) {
    let subid = manager.entityChanged.subscribe((data: { entityAction: EntityAction }) => {
      if (data.entityAction === EntityAction.PropertyChange || data.entityAction === EntityAction.EntityStateChange) {
        component.forceUpdate();
      }
    });
    component["subid"] = subid;
  }

  /** Remove subscription created with subscribeComponent() */
  unsubscribeComponent(manager: EntityManager, component: any) {
    if (component.subid) {
      manager.entityChanged.unsubscribe(component.subid);
    }
  }
}

export const entityManagerProvider = new EntityManagerProvider();
```

That's a lot of code, so let's break it down.

- The constructor configures Breeze adapters to work with a React app and our server's API conventions.

  - `ModelLibraryBackingStoreAdapter` stores data in entities in a way that is compatible with React
  - `UriBuilderJsonAdapter` encodes Breeze queries in JSON format in query URIs
  - `AjaxFetchAdapter` uses the browser's `fetch` API for performing AJAX requests
  - `DataServiceWebApiAdapter` turns server responses into Breeze entities
  - `NamingConvention` sets how Breeze converts entity property names between client and server

- The constructor then creates a `masterManager` and configures it with our entity metadata and server address.  You will need to update the `serviceName` to match your server's breeze endpoint.
- The `newManager` method returns a new, empty `EntityManager`, configured like the `masterManager`.
- The `subscribeComponent` method hooks a component into the entity life-cycle.  It tells the component to update its view whenever an entity property changes.  React only re-renders the parts of the view that have actually changed.
- The `unsubscribeComponent` method removes the component subscription from the EntityManager.

We will use the EntityManagerProvider in our component.

## Create the Customer component

Now create a component to display some customer data.  In the `src` directory, create a file called `Customers.tsx`.

Populate the file with the following:
```
import React from 'react';

export class Customers extends React.Component {

  render() {
    return (
      <div>
        <h1>Customers</h1>
      </div>
    );
  }
}
```
This is just the beginning of our component.  We'll be adding more to it soon.

## Show the Customers component

The new component won't display yet because there is no way to get to it.  We will fix that by changing the App component to show it.

Edit `App.tsx`.  Remove the existing code, and make it return a `div` displaying our customer component:
```
import React from 'react';
import './App.css';
import { Customers } from './Customers';

const App: React.FC = () => {
  return (
    <div className="App">
      <Customers />
    </div>
  );
}

export default App;
```

Try it now: if the app is not already running, open a command prompt in the `northwind-react` directory and run:

`npm start`

Then open your browser to [http://localhost:3000/](http://localhost:3000/).  You should see a screen that says "**Customers**" in large text.

### Start the server

Start the server project now (`NorthwindServer` or `NorthwindSequelize`), so it will be available to serve data requests.  If you haven't created the server,
refer back to the [STEPS](../STEPS.md) document.

## Get Customer data

Let's use our Customers component to display some customer data using Breeze.

#### State and EntityManager

We'll start by defining the interface for the `state` that our component will manipulate.  We'll call the interface `CustState`,
and give it two properties: a list of customers, and a selected customer:
```
import { Customer } from './model/customer';
import { entityManagerProvider } from './model/entity-manager-provider';
import { EntityManager, EntityQuery } from 'breeze-client';

interface CustState {
  customers: Customer[];
  selected: Customer;
}
```
Change the component declaration to say that it is using `CustState`, and add a field for an `EntityManager` instance:
```
export class Customers extends React.Component<any, CustState> {

    manager: EntityManager;
```
Create a constructor for the class, which initializes the state and the manager:
```
  constructor(props: any) {
    super(props);
    this.state = {
      customers: [] as Customer[],
      selected: null as Customer
    };
    this.manager = entityManagerProvider.newManager();
  }
```

#### Lifecycle Events

When our component is mounted (placed into the component tree), we want to subscribe to changes in the EntityManager.
This will let our component be updated when data is loaded or changed.
We will subscribe in the [componentDidMount](https://reactjs.org/docs/react-component.html#componentdidmount) method.

```
  componentDidMount() {
    entityManagerProvider.subscribeComponent(this.manager, this);
  }
```
We then need to unsubscribe when the component is unmounted, via the [componentWillUnmount](https://reactjs.org/docs/react-component.html#componentwillunmount) method:
```
  componentWillUnmount() {
    entityManagerProvider.unsubscribeComponent(this.manager, this);
  }
```

#### Query the Customers

Now we will add a Breeze query.  When the component mounts, we will query a list of customers from the server, and update
the component's `state` with the new data.  The [executeQuery](http://breeze.github.io/doc-js/api-docs/classes/entitymanager.html#executequery)
method returns a Promise, so we'll update the `state` when the Promise is fullfilled.

Update the [componentDidMount](https://reactjs.org/docs/react-component.html#componentdidmount) method to add the query lines:
```
  componentDidMount() {
    entityManagerProvider.subscribeComponent(this.manager, this);

    const query = new EntityQuery("Customers").where("lastName", "startsWith", "C").expand("orders");
    this.manager.executeQuery(query).then(qr => {
      this.setState({
        customers: qr.results
      });
    });
  }
```
Note that, to keep the display size small, we've used the Breeze query syntax to limit the results to just those customers whose `lastName` starts with "C".
There are many examples of Breeze queries in the [Breeze documentation](http://breeze.github.io/doc-js/query-examples.html).

#### Display the Customers

Now we need to change the `render` method to display the customers that are in the component's `state`.  The 
customers are in an array, so for simplicity we will use a table to display them.  We will loop through
the customers using the `Array.map` method.

The `Customer` entity has several properties, but we'll just display the `firstName`, `lastName` and the [entityState](http://breeze.github.io/doc-js/api-docs/classes/entitystate.html) of the customer.
The entityState indicates whether the Customer has been changed since it was queried from the server.  Right now, all of our customers
will be **Unchanged**, but we will be modifying them later.

Our updated `render` method will look like this:
```
  render() {
    return (
      <div>
        <h1>Customers</h1>

        <table style={{margin: 'auto'}}>
          <tbody>
            {this.state.customers.map(cust =>
             <tr key={cust.id}>
              <td>{cust.firstName} {cust.lastName}</td>
              <td>{cust.entityAspect.entityState.name}</td>
            </tr>)
            }
          </tbody>
        </table>

      </div>
    );
  }
```
#### Try it out

Now your `Customers.tsx` file should look like this:
```
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

        <table style={{margin: 'auto'}}>
          <tbody>
            {this.state.customers.map(cust =>
             <tr key={cust.id}>
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
```

Go back to the browser on [http://localhost:3000/](http://localhost:3000/) and refresh the page.  You should see
the list of customers:

Now you should see the data display on the page:
```
Customers

Frédérique Citeaux  Unchanged
Francisco Chang     Unchanged
Aria Cruz           Unchanged
Simon Crowtherm	    Unchanged
Lúcia Carvalho      Unchanged
Alejandra Camino    Unchanged
Pascale Cartrain    Unchanged
```

## Editing

Now we'll add editing functions to the CustomerComponent.  The behavior will be:

 - Click on a row to select a customer
 - A form appears, to allow editing or deleting the selected customer
 - One or more customers can be edited before saving
 - A save button saves the changes to the database
 - A revert button restores all customers to their last-saved condition

### Selecting a Customer

In the `Customers.tsx` file, edit the `render` method.  Make two changes to the opening `<tr>` tag:
 - set the **style** of the customer rows so that the background will be a different color for the selected row
 - add an **onClick** handler to set the `selected` property of the state to the current customer 
```
  <tr key={cust.id} 
    style={{backgroundColor: (cust === this.state.selected) ? 'lightgray' : 'white'}}
    onClick={() => this.setState({ selected: cust })}>
```
Save this change, and go back to the browser and refresh the page.  Now you should be able
to click on a row and see the customer highlighted.

### Add Edit Methods

Back in the `Customers.tsx` file, we will add methods to add a customer, delete a customer, save changes, and revert changes.
```
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
```
These methods use the Breeze [EntityManager](http://breeze.github.io/doc-js/api-docs/classes/entitymanager.html) and 
[EntityAspect](http://breeze.github.io/doc-js/api-docs/classes/entityaspect.html) to manipulate the entities.

Breeze keeps track of the state of each entity, and syncs up with the server when `saveChanges()` is called.

Since these methods use `this` internally, we need to `bind` them to our component so that they have the right `this` when called.
Add the following lines at the end of the constructor:
```
  this.saveChanges = this.saveChanges.bind(this);
  this.rejectChanges = this.rejectChanges.bind(this);
  this.addCustomer = this.addCustomer.bind(this);
  this.remove = this.remove.bind(this);
```

### Add Input Fields

Now we'll add `<input>` elements for the customer properties.  Our `render()` method is becoming large, so we'll 
create a separate method, `renderCustEdit()`, to hold the code for editing.
```
  renderCustEdit() {
    let cust = this.state.selected;
    if (cust) {
      return <div><h3>Edit</h3>
        <div>First Name: <input type="text" name="firstName" value={cust.firstName || ''} onChange={cust.handleChange} /></div>
        <div>Last Name: <input type="text" name="lastName" value={cust.lastName || ''} onChange={cust.handleChange} /></div>
        <div>City: <input type="text" name="city" value={cust.city || ''} onChange={cust.handleChange} /></div>
        <div>Country: <input type="text" name="country" value={cust.country || ''} onChange={cust.handleChange} /></div>
        <div>Phone: <input type="text" name="phone" value={cust.phone || ''} onChange={cust.handleChange} /></div>
      </div>
    }
  }
```
The method begins by getting the selected customer.  The method only renders the input form if a customer is selected.

Each input element gets its `value` from a property of the customer entity.  And each has an `onChange` handler
that updates the value of the property in the customer entity when the value of the input changes.

Now we need to call the `renderCustEdit()` method from `render()`, so that our inputs will show when a customer is
selected.  

We also need to be able to save the changes after we have edited one or more customers, and to
revert the changes to restore customers to their original state.  We already added the `saveChanges`
and `rejectChanges` methods above, so we just need to add buttons to call them.

Put the following lines after the `</table>`:
```
  {this.renderCustEdit()}

  <div style={{marginTop: '20px'}}>
    <button type="button" disabled={!this.manager.hasChanges()} onClick={this.saveChanges}>Save Changes</button>
    <button type="button" disabled={!this.manager.hasChanges()} onClick={this.rejectChanges}>Revert Changes</button>
  </div>
```
The buttons call the `saveChanges` and `rejectChanges` methods in their `onClick` handlers.  
The buttons are disabled unless there are changes to one or more entities.

This will show the input fields when a customer is selected, and it will show the Save and Revert buttons.
The Save and Revert buttons will be disabled unless there are modified entities.


Now, when you click on a customer, you should see an edit section appear, with inputs for each
of the customer properties.  

As you try out the form, observe a few behaviors:
- when you change a property of the customer, the 
[entityState](http://breeze.github.io/doc-js/api-docs/classes/entitystate.html) of the customer
changes from **Unchanged** to **Modified**.  
- you can click around to several customers and make changes to them
- when you click **Revert Changes**, all customers are restored to their last-saved state
- when you click **Save Changes**, all customer changes are saved, and their state is set to **Unchanged**

### Add a customer

Now we will add a new customer.  We already have the `addCustomer` method in our code, we just need to add the button.

Add the following line, after the customer table in the `render` method:
```
<button type="button" onClick={this.addCustomer}>Add Customer</button>
```
When you click the button, the `addCustomer` method creates a new Customer entity, and adds it to the component's `state.customers` array.
It also sets the `state.selected` property to the new Customer.  

These actions cause the component to update the UI,
adding a new row to the customers table, and selecting the new customer for editing, so you can edit its properties.

The new customer's EntityState is **Added**.  It will remain Added until it is either saved or deleted.
See more about change tracking in the [Breeze documentation](http://breeze.github.io/doc-js/lap-changetracking.html)

### Delete a customer

We already added the `remove` method earlier, so now let's add a button to call it.  This button will delete the selected
customer, so we'll put it in the editing area when a customer is selected.

Add the following line after all the input lines in the `renderCustEdit` method:
```
<button type="button" onClick={this.remove.bind(this, cust)}>Delete</button>
```
When you click the button, the `remove` method changes the selected customer's EntityState, but it doesn't
remove the customer from the list in the UI.  That will happen after the changes are saved or reverted, and the 
list is rebuilt.

> Note that when an **Unchanged** or **Modified** customer is deleted, its EntityState becomes **Deleted**.  
But when an **Added** customer is deleted, its EntityState becomes **Detached**.  This is because
the newly-added entity does not need to be deleted from the server, because it doesn't exist there.
You can learn more about entity state transitions in the [Breeze documentation](http://breeze.github.io/doc-js/inside-entity.html). 

### Test the editing

Now you should be able to add a new Customer, edit the properties of new and existing customers, delete customers, and save
the changes in a batch.  (Remember that we only query customers where lastName starts with "C").

If you open your browser's developer tools (F12), you can see the network traffic between the Breeze client and the server API
as queries and saves are sent.

## Conclusion

We have come to the end of our journey.  

We've created a React + Breeze application from the ground up,
using tools to create a simple entity model from the database for both the client and server parts of the application.

We now have an application that can create, read, update, and delete data.  It's ready for an improved UI, 
and it's ready to be extended to cover more entity types and more complex uses cases.
<hr>
If you have problems with this demo, please create issues in this github repo.

If you have questions about Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).


