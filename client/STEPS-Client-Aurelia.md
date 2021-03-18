# Steps for creating a Breeze Aurelia App

Here are some steps to follow to create a new [Aurelia 2](https://aurelia.io) application, using Breeze to handle the data management.

We will assume that you've already got the server side created, following the outline described in the [STEPS](../STEPS.md) document.

For the client, we will start with an empty directory and build an application that
talks to the server, using Breeze to query and update data.

Along the way we will:

- Create an Aurelia application using the CLI
- Create TypeScript entity classes from the server metadata
- Create an Aurelia component to read and update entities

# Create the Aurelia App

To create the initial shell of the Aurelia app, we will use the Aurelia CLI as instructed in the [Aurelia 2 Quick Start](https://docs.aurelia.io/getting-started/quick-install-guide).

First, make sure you have [nodejs](https://nodejs.org) >= 14 and [npm](https://docs.npmjs.com/) installed.  

_Note that if you update node from a previous version, you may need to remove your `npm` folder and [re-install npm](https://stackoverflow.com/a/63337788/3280710).

Next, open a command prompt in the `client` directory, and follow the steps below:

1. `npx makes aurelia`
  - Ok to proceed? **y**
  - Please name this new project: **northwind-aurelia**
  - Would you like to use the default setup?: **Default TypeScript Aurelia 2 app**
  - Do you want to install npm dependencies now?: **Yes, use npm**

Now you should have a `client/northwind-aurelia` directory containing the Aurelia app.  Try it out:

`cd northwind-aurelia`
`npm start`

This will compile the app and start the server for it.  Open a browser on http://localhost:9000 to see the "Hello, World!" page.  

You can learn more about the app structure in the [Aurelia documentation](http://docs.aurelia.io/)

Stop the server from the command line using Ctrl-C.

## Add Breeze packages

Now we'll add Breeze to the app, so we can query entities from the server and update them.

Start by adding the npm packages.  In the `northwind-aurelia` directory, run:

`npm install breeze-client breeze-entity-generator`

## Generate Entities

When developing our app, it's helpful to have TypeScript classes to represent the entity data that comes from the server.  The data is in the form of Breeze entities, so we will first create a base class to represent that.

#### Create the base class

In the `northwind-aurelia/src` directory, create a new directory, `model`.  

Then, in `northwind-aurelia/src/model`, create a new TypeScript file, `base-entity.ts`.  Populate the file with:
```
import { Entity, EntityAspect, EntityType } from 'breeze-client';

export class BaseEntity implements Entity {
  entityAspect: EntityAspect;
  entityType: EntityType;
}
```
When we generate the entities, we will tell the entity generator to use this base class.

#### Generate metadata from server

You should already have a `metadata.json` file in the [server](../server) directory. 
If you don't, see the "Generate the metadata" topic in the STEPS document for your server.

#### Generate entities from metadata
To turn the metadata into entities, we need to write a script.  In the `northwind-aurelia` directory,
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

`node generate-entities`

This should create files in the `northwind-aurelia/src/app/model` directory:
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

_For simplicity, we'll put this in the `src` folder.  In a real project, you might want to create
a separate subdirectory for services._

Create the file `northwind-aurelia/src/entity-manager-provider.ts`.  In the file, put:
```
import { DI } from "aurelia";
import { DataService, EntityManager, NamingConvention } from "breeze-client";
import { AjaxFetchAdapter } from "breeze-client/adapter-ajax-fetch";
import { DataServiceWebApiAdapter } from "breeze-client/adapter-data-service-webapi";
import { ModelLibraryBackingStoreAdapter } from "breeze-client/adapter-model-library-backing-store";
import { UriBuilderJsonAdapter } from "breeze-client/adapter-uri-builder-json";
import { NorthwindMetadata } from "./model/metadata";
import { NorthwindRegistrationHelper } from "./model/registration-helper";

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
}

// Register as singleton with Dependency Injection
DI.singleton(EntityManagerProvider);
```

That's a lot of code, so let's break it down.

- The constructor configures Breeze adapters to work with Aurelia and our server's API conventions.

  - `ModelLibraryBackingStoreAdapter` stores data in entities in a way that is compatible with Aurelia
  - `UriBuilderJsonAdapter` encodes Breeze queries in JSON format in query URIs
  - `AjaxFetchAdapter` uses the browser's `fetch` API for performing AJAX requests (same as Aurelia)
  - `DataServiceWebApiAdapter` turns server responses into Breeze entities
  - `NamingConvention` sets how Breeze converts entity property names between client and server

- The constructor then creates a DataService that the EntityManager uses to talk to the server.  The `serviceName` should match your server's breeze endpoint.

- The constructor then creates a `masterManager` and configures it with our entity metadata and model constructors.

- The `newManager` method returns a new, empty `EntityManager`, configured like the `masterManager`.  We'll call this method from our components.

- Finally, we register the EntityManagerProvider with Dependency Injection, so that we can inject it in our components.

## Create the Customer component

Now create a component to display some customer data.  In the `src` directory, create a file called `customers.ts`.

Populate the file with the following:
```js
export class Customers {
}
```

Create a corresponding view for the file, `customers.html`, and populate it with:
```html
<h2>Customers</h2>
```

This is just the beginning of our component.  We'll be adding more to it soon.

## Show the Customer component

The new component won't display yet because there is no way to get to it.  We will fix that by adding it to the `MyApp` component that was generated for us.

Edit `my-app.html` and add the `import` and `customers` tags as shown below.
```html
<import from="./customers"></import>

<div class="message">${message}</div>

<customers></customers>
```
The will show the "Customers" heading below the "Hello, World!" statement.

### Try it

Try it now: if the app is not already running, open a command prompt in the `northwind-aurelia` directory and run:

`npm start`

Then open your browser to [http://localhost:9000/](http://localhost:9000/).  

You should see a screen that says "Hello, World" and "**Customers**" in large text.

### Start the server

Start the server project now (`NorthwindServer` or `NorthwindSequelize`), so it will be available to serve data requests.  If you haven't created the server,
refer back to the [STEPS](../STEPS.md) document.

## Get Customer data

Now we'll change the Customers component to display customer data using Breeze.

### Viewmodel

Edit `customers.ts`.  First we'll need some imports:
```js
import { inject } from "@aurelia/kernel";
import { EntityManager, EntityQuery } from "breeze-client";
import { EntityManagerProvider } from "./entity-manager-provider";
import { Customer } from "./model/customer";
```

In the body of the `Customers` class, add fields for an array of Customer and an EntityManager.

Add a constructor that accepts an EntityManagerProvider, and add an `inject` decorator so that DI will pass it in.

The constructor creates a new manager an assigns it to the `manager` propery.
```js
@inject(EntityManagerProvider)
export class Customers {
  public customers: Customer[];
  private manager: EntityManager;
 
  constructor(emp: EntityManagerProvider) {
    this.manager = emp.newManager();
  }

```
Now we'll add the `created` life-cycle method.  This method will query for some Customers when the component is created.
```js
  created() {
    const query = new EntityQuery('Customers').where('lastName', 'startsWith', 'C');
    this.manager.executeQuery(query).then(qr => {
      this.customers = qr.results;
    });    
  }
```
Note that, to keep the display size small, we've limited the results to just those customers whose `lastName` starts with "C".

### View

Edit `customers.html`.  Add a `ngFor` loop to display some properties of the customers:
```html
<h2>Customers</h2>
<table>
  <tr repeat.for="cust of customers">
    <td>${cust.firstName} ${cust.lastName}</td>
  </tr>
</table>    
```
Now you should see the data display on the page:
```
Customers

Frédérique Citeaux
Francisco Chang
Aria Cruz
Philip Cramer
Simon Crowther
Lúcia Carvalho
Alejandra Camino
Pascale Cartrain
```

## Editing

Now we'll add editing functions to the Customers component.  The behavior will be:

 - Click on a row to select a customer
 - A form allows editing or deleting the selected customer
 - One or more customers can be edited before saving
 - A save button saves the changes to the database
 - A revert button restores all customers to their last-saved condition

### Change Component Class

We'll start in the `customers.ts` file.  First add a field to keep track of the selected customer:
```
  selected: Customer;
```
Then add methods to add a customer, delete a customer, save changes, and revert changes:
```js
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
```
### Select a customer

Now we'll change the HTML template to allow selecting a customer from the list.

_NOTE: We are intentionally using a minimum of styling to keep things simple._

Edit `customers.html` and change the `table`.
Add a click handler that sets the selected customer, and a `style` attribute that highlights the selected line.  

Add another table column that shows the state of each customer entity.
```html
<table>
  <tr repeat.for="cust of customers" click.delegate="selected = cust"
    style.bind="{'background-color': selected === cust ? 'lightgray':'white'}">
    <td>${cust.firstName} ${cust.lastName}</td>
  </tr>
</table>    
```
Try it, and make sure the rows highlight when you click on them.

### Add a customer

Below the table, create an "Add" button that calls the `addCustomer` method in the component class.
```html
<button type="button" click.trigger="addCustomer()">Add</button>
```

### Edit customer properties

Below the "Add" button, create a set of inputs for editing the properties of the customer.

Use an 'if` to only show this section if a customer is selected and the customer is not marked for deletion.

Also create a "Delete" button that calls the `delete` method in the component class.
```html
<div if.bind="selected && !selected.entityAspect.entityState.isDeleted()">
  <h3>Edit</h3>
  <div>First Name: <input type="text" name="firstName" value.bind="selected.firstName"></div>
  <div>Last Name: <input type="text" name="lastName" value.bind="selected.lastName"></div>
  <div>City: <input type="text" name="city" value.bind="selected.city"></div>
  <div>Country: <input type="text" name="country" value.bind="selected.country"></div>
  <div>Phone: <input type="text" name="phone" value.bind="selected.phone"></div>
  <button type="button" click.trigger="delete(selected)">Delete</button>
</div>
```

### Save and Revert

Below the editing section, add a "Save Changes" button that calls the `saveChanges` method in the component class.

Add a "Revert Changes" button that calls the `rejectChanges` method in the component class.

Only show the buttons if the are changes to entities in the entity manager's cache.
```
<div if.bind="hasChanges">
  <hr>
  <button type="button" click.trigger="saveChanges()">Save Changes</button>
  <button type="button" click.trigger="rejectChanges()">Revert Changes</button>
</div>
```
### Test the editing

Now you should be able to add a new Customer, edit the properties of new and existing customers, delete customers, and save
the changes in a batch.  (Remember that we only query customers where lastName starts with "C").

If you open your browser's developer tools (F12), you can see the network traffic between the Breeze client and the server API
as queries and saves are sent.

## Conclusion

We have come to the end of our journey.  

We've created a Aurelia + Breeze application from the ground up,
using tools to create a simple entity model from the database for both the client and server parts of the application.

We now have an application that can create, read, update, and delete data.  It's ready for an improved UI, 
and it's ready to be extended to cover more entity types and more complex uses cases.
<hr>
If you have problems with this demo, please create issues in this github repo.

If you have questions about Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).


