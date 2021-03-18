# Steps for creating a Breeze Angular App

Here are some steps to follow to create a new [Angular](https://angular.io) application, using Breeze to handle the data management.

We will assume that you've already got the server side created, following the outline described in the [STEPS](../STEPS.md) document.

For the client, we will start with an empty directory and build an application that
talks to the server, using Breeze to query and update data.

Along the way we will:

- Create an Angular application using the CLI
- Create TypeScript entity classes from the server metadata
- Create an Angular component to read and update entities

# Create the Angular App

To create the initial shell of the Angular app, we will use the Angular CLI as instructed in the [Angular.io Guide](https://angular.io/guide/setup-local).

First, make sure you have [nodejs](https://nodejs.org) and [npm](https://docs.npmjs.com/) installed.

Next, open a command prompt in the `client` directory, and follow the steps below:

1. `npx @angular/cli new northwind-angular`
  - Would you like to add Angular routing? **Y**
  - Which stylesheet format would you like to use? **CSS**

Now you should have a `client/northwind-angular` directory containing the Angular app.  Try it out:

`cd northwind-angular`
`ng serve --open`

This will compile the app and open a browser on http://localhost:4200 with a welcome page.  

You can learn more about the app structure in the [Angular workspace documentation](https://angular.io/guide/file-structure)

Stop the server from the command line using Ctrl-C.

## Add Breeze packages

Now we'll add Breeze to the app, so we can query entities from the server and update them.

Start by adding the npm packages.  In the `northwind-angular` directory, run:

`npm install breeze-client breeze-entity-generator`

## Generate Entities

When developing our app, it's helpful to have TypeScript classes to represent the entity data that comes from the server.  The data is in the form of Breeze entities, so we will first create a base class to represent that.

#### Create the base class

In the `northwind-angular/src/app` directory, create a new directory, `model`.  

Then, in `northwind-angular/src/app/model`, create a new TypeScript file, `base-entity.ts`.  Populate the file with:
```
import { Entity, EntityAspect, EntityType } from 'breeze-client';

export class BaseEntity implements Entity {
  entityAspect: EntityAspect;
  entityType: EntityType;
}
```
When we generate the entities, we will tell the entity generator to use this base class.

#### Generate metadata from server

You should already have a `metadata.json` file in the `NorthwindServer` project directory. 
If you don't, see the "Generate the metadata" topic in the server document.

#### Generate entities from metadata
To turn the metadata into entities, we need to write a script.  In the `northwind-angular` directory,
create a file called `generate-entities.js`.

Fill `generate-entities.js` with the following:
```
const tsGen = require('breeze-entity-generator/tsgen-core');
const fs = require('fs');
const dir = './src/app/model';

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

This should create files in the `northwind-angular/src/app/model` directory:
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

## Configure App Module

Now we need to register the Breeze adapters to work with Angular.  

Edit `northwind-angular\src\app\app.module.ts`.  At the top of the file, add the following imports:
```
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NamingConvention } from 'breeze-client';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';
import { AjaxHttpClientAdapter } from 'breeze-client/adapter-ajax-httpclient';
```
Add `HttpClientModule` and `FormsModule` to the `imports` section of the `@NgModule` declaration:
```
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule
  ],
```

In the class declaration at the bottom of the file, add the constructor:
```
export class AppModule {
  constructor(http: HttpClient) {
    // Configure Breeze adapters
    ModelLibraryBackingStoreAdapter.register();
    UriBuilderJsonAdapter.register();
    AjaxHttpClientAdapter.register(http);
    DataServiceWebApiAdapter.register();
    NamingConvention.camelCase.setAsDefault();
  }
}
```
That's a lot of adapters!  Let's look at what they do:
 - `ModelLibraryBackingStoreAdapter` stores data in entities in a way that is compatible with Angular
 - `UriBuilderJsonAdapter` encodes Breeze queries in JSON format in query URIs
 - `AjaxHttpClientAdapter` uses Angular's HttpClient for performing AJAX requests
 - `DataServiceWebApiAdapter` turns server responses into Breeze entities
 - `NamingConvention` sets how Breeze converts entity property names between client and server

## Create the environment settings

The client application needs to know the URL to reach the server.  This sort of this is environment-specific,
so we'll keep it in the `environment.ts` file.

Edit `src/environments/environment.ts` and add a line for breezeApiRoot.  The port should be the one
on which your NorthwindServer is listening, and the path is the path to your BreezeController.
```
export const environment = {
  production: false,
  breezeApiRoot: 'http://localhost:33028/api/breeze'
};
```

## Create the EntityManagerProvider

In a Breeze application, the [EntityManager](http://breeze.github.io/doc-js/entitymanager-and-caching.html) caches the
entities and keeps track of the changes.  You may need more than one, if you want to keep multiple change sets.  To make
it easy, we will create a service called the EntityManagerProvider.

_In a real project, now would be a good time to start creating submodules.  For this demo, we will keep everything in one
module for simplicity._

Create the file `northwind-angular/src/app/entity-manager-provider.ts`.  In the file, put:
```
import { Injectable } from '@angular/core';
import { DataService, EntityManager } from 'breeze-client';
import { environment } from '../environments/environment';
import { NorthwindMetadata } from './model/metadata';
import { NorthwindRegistrationHelper } from './model/registration-helper';

@Injectable({providedIn: 'root'})
export class EntityManagerProvider {

  protected masterManager: EntityManager;

  constructor() {
    const dataService = new DataService({
      serviceName: environment.breezeApiRoot,
      hasServerMetadata: false
    });

    this.masterManager = new EntityManager({ dataService });
    const metadataStore = this.masterManager.metadataStore;
    metadataStore.importMetadata(NorthwindMetadata.value);
    NorthwindRegistrationHelper.register(metadataStore);
  }

  newManager(): EntityManager {
    return this.masterManager.createEmptyCopy();
  }
}
```
This code creates a new "master" manager and configures its metadata.  
It exposes a `newManager()` method that creates a copy of the master complete with metadata.
When we need an EntityManager, we call the `newManager()` method.

## Create the Customer component

Now create a component to display some customer data.  Open a command prompt in the `northwind-angular` directory, and execute the command:

`ng generate component customer`

Then look in the `src/app/customer` directory to see the component files:
```
customer.component.css
customer.component.html
customer.component.spec.ts
customer.component.ts
```
## Show the Customer component

The new component won't display yet because there is no way to get to it.  We will fix that by changing the app module to route to it.

First, edit `app.component.html` and delete **everything except** the `router-outlet` tag.  Then add a heading:
```
<h1>Northwind</h1>
<router-outlet></router-outlet>
```
Then edit `app-routing.module.ts` and add some routes:
```
const routes: Routes = [
  {
    path: 'customers',
    component: CustomerComponent,
  },
  {
    path      : '**',
    redirectTo: 'customers'
  }
];
```
The first route will load the CustomerComponent into the `router-outlet` if the url is /customers.

The second route will redirect to /customers if the current url doesn't match any other route.  Since there are no other routes, our CustomerComponent should always be displayed.

Try it now: if the app is not already running, open a command prompt in the `northwind-angular` directory and run:

`ng serve --open`

You should see a screen that says "Northwind" followed by "customer works!".

### Start the server

Start the server project now (`NorthwindServer` or `NorthwindSequelize`), so it will be available to serve data requests.  If you haven't created the server,
refer back to the [STEPS](../STEPS.md) document.

### Get Customer data

Edit `customer.component.ts`.  In the body of the `CustomerComponent` class, add fields for EntityManager and a list of Customers, and change the constructor so it accepts an EntityManagerProvider and stores it in a private field:
```
  manager: EntityManager;
  customers: Customer[];
  constructor(private entityManagerProvider: EntityManagerProvider) { }
```
Then edit the `ngOnInit` method to create an EntityManager and perform a Breeze query:
```
  ngOnInit() {
    this.manager = this.entityManagerProvider.newManager();
    const query = new EntityQuery('Customers').where('lastName', 'startsWith', 'C');
    this.manager.executeQuery(query).then(qr => {
      this.customers = qr.results;
    });
  }
```
Note that, to keep the display size small, we've limited the results to just those customers whose `lastName` starts with "C".

The query results are assigned to the `customers` field in the component.

### Show the data

Edit the HTML template, `customer.component.html`.  Add a `ngFor` loop to display some properties of the customers:
```
<p>customer works!</p>

<table>
  <tr *ngFor="let cust of customers">
    <td>{{cust.firstName}} {{cust.lastName}}</td>
  </tr>
</table>
```
Now you should see the data display on the page:
```
Northwind

customer works!

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

Now we'll add editing functions to the CustomerComponent.  The behavior will be:

 - Click on a row to select a customer
 - A form allows editing or deleting the selected customer
 - One or more customers can be edited before saving
 - A save button saves the changes to the database
 - A revert button restores all customers to their last-saved condition

### Change Component Class

We'll start in the `customer.component.ts` file.  First add a field to keep track of the selected customer:
```
  selected: Customer;
```
Then add methods to add a customer, delete a customer, save changes, and revert changes:
```
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
```
### Select a customer

Now we'll change the HTML template to allow selecting a customer from the list.

_NOTE: We are intentionally using a minimum of styling to keep things simple._

Edit `customer.component.html` and change the `table`.
Add a click event that sets the selected customer, and a `ngStyle` directive that highlights the selected line.  

Add another table column that shows the state of each customer entity.
```
<table>
  <tr *ngFor="let cust of customers" (click)="selected = cust"
    [ngStyle]="{'background-color': selected === cust ? 'lightgray':'white'}">
    <td>{{cust.firstName}} {{cust.lastName}}</td>
    <td>{{cust.entityAspect.entityState}}</td>
  </tr>
</table>
```
Try it, and make sure the rows highlight when you click on them.

### Add a customer

Below the table, create an "Add" button that calls the `addCustomer` method in the component class.
```
<button type="button" (click)="addCustomer()">Add</button>
```

### Edit customer properties

Below the "Add" button, create a set of inputs for editing the properties of the customer.

Use an `*ngIf` to only show this section if a customer is selected and the customer is not marked for deletion.

Also create a "Delete" button that calls the `delete` method in the component class.
```
<div *ngIf="selected && !selected.entityAspect.entityState.isDeleted()">
  <h3>Edit</h3>
  <div>First Name: <input type="text" name="firstName" [(ngModel)]="selected.firstName"></div>
  <div>Last Name: <input type="text" name="lastName" [(ngModel)]="selected.lastName"></div>
  <div>City: <input type="text" name="city" [(ngModel)]="selected.city"></div>
  <div>Country: <input type="text" name="country" [(ngModel)]="selected.country"></div>
  <div>Phone: <input type="text" name="phone" [(ngModel)]="selected.phone"></div>
  <button type="button" (click)="delete(selected)">Delete</button>
</div>
```

### Save and Revert

Below the editing section, add a "Save Changes" button that calls the `saveChanges` method in the component class.

Add a "Revert Changes" button that calls the `rejectChanges` method in the component class.

Only show the buttons if the are changes to entities in the entity manager's cache.
```
<div *ngIf="manager.hasChanges()">
  <hr>
  <button type="button" (click)="saveChanges()">Save Changes</button>
  <button type="button" (click)="rejectChanges()">Revert Changes</button>
</div>
```
### Test the editing

Now you should be able to add a new Customer, edit the properties of new and existing customers, delete customers, and save
the changes in a batch.  (Remember that we only query customers where lastName starts with "C").

If you open your browser's developer tools (F12), you can see the network traffic between the Breeze client and the server API
as queries and saves are sent.

## Conclusion

We have come to the end of our journey.  

We've created a Angular + Breeze application from the ground up,
using tools to create a simple entity model from the database for both the client and server parts of the application.

We now have an application that can create, read, update, and delete data.  It's ready for an improved UI, 
and it's ready to be extended to cover more entity types and more complex uses cases.
<hr>
If you have problems with this demo, please create issues in this github repo.

If you have questions about Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).


