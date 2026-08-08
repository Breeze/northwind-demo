# Steps for creating a Breeze Angular 22 App

Here are some steps to follow to create a new [Angular](https://angular.dev) 22 application, using Breeze to handle the data management.

We will assume that you've already got the server side created, following the outline described in the [STEPS](../STEPS.md) document.

For the client, we will start with an empty directory and build an application that
talks to the server, using Breeze to query and update data.

Along the way we will:

- Create an Angular application using the CLI
- Create TypeScript entity classes from the server metadata
- Create an Angular component to read and update entities

> Looking for the older sample?  See [STEPS-Client-Angular8](STEPS-Client-Angular8.md) for the Angular 8
> version, which is in the [northwind-angular8](northwind-angular8) directory.  A summary of what changed
> between the two is at the [end of this document](#whats-different-from-the-angular-8-version).

# Create the Angular App

To create the initial shell of the Angular app, we will use the Angular CLI as instructed in the [Angular CLI Guide](https://angular.dev/installation).

First, make sure you have [nodejs](https://nodejs.org) and [npm](https://docs.npmjs.com/) installed.

**Angular 22 requires Node.js v22.22.3 or later** (or v24.15+, or v26+).  Older versions of Node - including
Node 22 releases earlier than 22.22.3 - will refuse to run the CLI with a message like:

```
Node.js version v22.14.0 detected.
The Angular CLI requires a minimum Node.js version of v22.22.3 or v24.15.0 or v26.0.0.
```

Check yours with `node --version` and upgrade if needed before continuing.

Next, open a command prompt in the `client` directory, and follow the steps below:

1. `npx @angular/cli@22 new northwind-angular22 --style=css --ssr=false`
  - The `--style=css` flag chooses plain CSS for the stylesheet format
  - The `--ssr=false` flag skips server-side rendering, which this demo does not need

Those two flags answer the only questions the CLI would otherwise ask, so the command runs without
prompting.  Note that there is no longer a prompt for routing - it is always configured now.

Now you should have a `client/northwind-angular22` directory containing the Angular app.  Try it out:

`cd northwind-angular22`
`ng serve --open`

This will compile the app and open a browser on http://localhost:4200 with a welcome page.

You can learn more about the app structure in the [Angular workspace documentation](https://angular.dev/reference/configs/file-structure)

Stop the server from the command line using Ctrl-C.

The application the CLI generates is quite different from the one in the Angular 8 walkthrough:

- It is **standalone**.  There is no `AppModule`; `main.ts` calls `bootstrapApplication(App, appConfig)`, and
  configuration lives in `src/app/app.config.ts`.
- It is **zoneless**.  `zone.js` is not even a dependency.  Angular no longer discovers changes by patching
  browser async APIs, so a component's state has to be held in **signals** for the template to re-render.
  This matters for us, because Breeze delivers query results in a promise.
- It uses **Vitest** rather than Karma and Jasmine for unit tests, and there is no Protractor e2e setup.

## Add Breeze packages

Now we'll add Breeze to the app, so we can query entities from the server and update them.

Start by adding the npm packages.  In the `northwind-angular22` directory, run:

`npm install breeze-client breeze-entity-generator`

## Generate Entities

When developing our app, it's helpful to have TypeScript classes to represent the entity data that comes from the server.  The data is in the form of Breeze entities, so we will first create a base class to represent that.

#### Create the base class

In the `northwind-angular22/src/app` directory, create a new TypeScript file, `base-entity.ts`.  Populate the file with:
```ts
import { Entity, EntityAspect, EntityType } from 'breeze-client';

export class BaseEntity implements Entity {
  entityAspect!: EntityAspect;
  entityType!: EntityType;
}
```
When we generate the entities, we will tell the entity generator to use this base class.

> **Two things to note here.**
>
> The file goes in `src/app`, **not** in `src/app/model` where the generated entities will land.  The entity
> generator emits `import { BaseEntity } from '../base-entity';`, so it expects the base class one directory
> above the generated files.
>
> The `!` after each property name is a *definite assignment assertion*.  Angular 22 uses TypeScript 6, which
> turns on `strict` mode by default, and strict mode rejects a class property that is declared but never
> assigned.  Breeze assigns these at runtime, so we tell the compiler to trust us.

#### Generate metadata from server

You should already have a `metadata.json` file in the `server` directory.
If you don't, see the "Generate the metadata" topic in the server document.

#### Generate entities from metadata
To turn the metadata into entities, we need to write a script.  In the `northwind-angular22` directory,
create a file called `generate-entities.js`.

Fill `generate-entities.js` with the following:
```js
var tsGen = require('breeze-entity-generator/tsgen-core');
var fs = require('fs');
var dir = './src/app/model';

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

This should create files in the `northwind-angular22/src/app/model` directory:
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

Open `customer.ts` and note that the generated properties carry the same strict-mode annotations we used in
the base class - `!` for required properties and `?` for nullable ones:
```ts
export class Customer extends BaseEntity  {
  id!: number;
  city?: string;
  country?: string;
  firstName!: string;
  lastName!: string;
  phone?: string;
  orders!: Order[];
}
```

_Note that you can customize the entity output by changing the parameters to the `generate` function,
and by changing the template files.  See `node_modules/breeze-entity-generator/README.md` for more information._

## Configure the application

Now we need to register the Breeze adapters to work with Angular.

In the Angular 8 version this went in the `AppModule` constructor.  There is no `AppModule` any more, so
instead we use an **app initializer**, which runs once during bootstrap - before any component can ask for
an `EntityManager`.

Edit `northwind-angular22/src/app/app.config.ts` and replace the contents with:
```ts
import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { NamingConvention } from 'breeze-client';
import { AjaxHttpClientAdapter } from 'breeze-client/adapter-ajax-httpclient';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Configure Breeze adapters before anything creates an EntityManager.
    // This is the standalone equivalent of the AppModule constructor.
    provideAppInitializer(() => {
      const http = inject(HttpClient);
      ModelLibraryBackingStoreAdapter.register();
      UriBuilderJsonAdapter.register();
      AjaxHttpClientAdapter.register(http);
      DataServiceWebApiAdapter.register();
      NamingConvention.camelCase.setAsDefault();
    }),
  ],
};
```
`provideHttpClient()` replaces the `HttpClientModule` import from the older version.

That's a lot of adapters!  Let's look at what they do:
 - `ModelLibraryBackingStoreAdapter` stores data in entities in a way that is compatible with Angular
 - `UriBuilderJsonAdapter` encodes Breeze queries in JSON format in query URIs
 - `AjaxHttpClientAdapter` uses Angular's HttpClient for performing AJAX requests
 - `DataServiceWebApiAdapter` turns server responses into Breeze entities
 - `NamingConvention` sets how Breeze converts entity property names between client and server

The order matters: `AjaxHttpClientAdapter` must be registered before `DataServiceWebApiAdapter`, because the
data service adapter looks up the ajax adapter when it initializes.

## Create the environment settings

The client application needs to know the URL to reach the server.  This sort of thing is environment-specific,
so we'll keep it in the environment files.

The CLI no longer creates them for you, so generate them:

`ng generate environments`

That creates `src/environments/environment.ts` and `src/environments/environment.development.ts`, and wires the
file replacement into `angular.json`.

> The sense of these files is **inverted** compared to the Angular 8 project.  `environment.ts` is now the
> *production* file - the one your code imports - and `environment.development.ts` replaces it during a
> development build.  (Previously `environment.ts` was the development file and `environment.prod.ts`
> replaced it.)

Put the `breezeApiRoot` in **both** files.  The port should be the one on which your NorthwindServer is
listening, and the path is the path to your BreezeController.

`src/environments/environment.ts`:
```ts
export const environment = {
  production: true,
  breezeApiRoot: 'http://localhost:4000/api/breeze',
};
```

`src/environments/environment.development.ts`:
```ts
export const environment = {
  production: false,
  breezeApiRoot: 'http://localhost:4000/api/breeze',
};
```

## Create the EntityManagerProvider

In a Breeze application, the [EntityManager](http://breeze.github.io/doc-js/entitymanager-and-caching.html) caches the
entities and keeps track of the changes.  You may need more than one, if you want to keep multiple change sets.  To make
it easy, we will create a service called the EntityManagerProvider.

Create the file `northwind-angular22/src/app/entity-manager-provider.ts`.  In the file, put:
```ts
import { Injectable } from '@angular/core';
import { DataService, EntityManager } from 'breeze-client';
import { environment } from '../environments/environment';
import { NorthwindMetadata } from './model/metadata';
import { NorthwindRegistrationHelper } from './model/registration-helper';

@Injectable({ providedIn: 'root' })
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

This file is unchanged from the Angular 8 version.

## Create the Customer component

Now create a component to display some customer data.  Open a command prompt in the `northwind-angular22` directory, and execute the command:

`ng generate component customer --type=component`

Then look in the `src/app/customer` directory to see the component files:
```
customer.component.css
customer.component.html
customer.component.spec.ts
customer.component.ts
```

> **Why `--type=component`?**  Modern Angular drops the `.component` suffix by default, so plain
> `ng generate component customer` would create `customer.ts` exporting a class named `Customer` - which
> collides with the `Customer` entity class we just generated.  The `--type=component` flag restores the
> older naming and keeps the two apart.

## Show the Customer component

The new component won't display yet because there is no way to get to it.  We will fix that by adding a route to it.

First, edit `app.html` and delete **everything**, replacing it with a heading and the router outlet:
```html
<h1>Northwind</h1>
<router-outlet></router-outlet>
```
Then edit `app.routes.ts` and add some routes:
```ts
import { Routes } from '@angular/router';
import { CustomerComponent } from './customer/customer.component';

export const routes: Routes = [
  {
    path: 'customers',
    component: CustomerComponent,
  },
  {
    path: '**',
    redirectTo: 'customers'
  }
];
```
The first route will load the CustomerComponent into the `router-outlet` if the url is /customers.

The second route will redirect to /customers if the current url doesn't match any other route.  Since there are no other routes, our CustomerComponent should always be displayed.

Try it now: if the app is not already running, open a command prompt in the `northwind-angular22` directory and run:

`ng serve --open`

You should see a screen that says "Northwind" followed by "customer works!".

### Start the server

Start the server project now (`NorthwindServer` or `NorthwindSequelize`), so it will be available to serve data requests.  If you haven't created the server,
refer back to the [STEPS](../STEPS.md) document.

### Get Customer data

Edit `customer.component.ts`.  In the body of the `CustomerComponent` class, add an EntityManager and a list of Customers:
```ts
  readonly manager = inject(EntityManagerProvider).newManager();
  readonly customers = signal<Customer[]>([]);
```
Then add an `ngOnInit` method that performs a Breeze query:
```ts
  ngOnInit() {
    const query = new EntityQuery('Customers').where('lastName', 'startsWith', 'C');
    this.manager.executeQuery(query).then(qr => {
      this.customers.set(qr.results);
    });
  }
```
Note that, to keep the display size small, we've limited the results to just those customers whose `lastName` starts with "C".

> **This is the one place where zoneless Angular changes the Breeze code.**  In the Angular 8 version,
> `customers` was a plain array field and the assignment `this.customers = qr.results` was enough, because
> zone.js noticed the promise callback and ran change detection.  With no zone, a plain field assignment
> would update the data but never repaint the screen.  Holding the list in a `signal` and calling `.set()`
> is what tells Angular to re-render.
>
> Also note the component uses `inject()` rather than constructor injection.  Either style works; `inject()`
> is the current idiom.

### Show the data

Edit the HTML template, `customer.component.html`.  Add a `@for` loop to display some properties of the customers:
```html
<p>customer works!</p>

<table>
  @for (cust of customers(); track cust) {
    <tr>
      <td>{{cust.firstName}} {{cust.lastName}}</td>
    </tr>
  }
</table>
```
`@for` is Angular's built-in control flow, which replaces the `*ngFor` structural directive.  It requires a
`track` expression, and it needs no module import.  Note the parentheses on `customers()` - it is a signal, so
we call it to read its value.

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

We'll start in the `customer.component.ts` file.  First add a signal to keep track of the selected customer:
```ts
  readonly selected = signal<Customer | undefined>(undefined);
```
Then add methods to add a customer, delete a customer, save changes, and revert changes:
```ts
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
```
`addCustomer` uses `update()` with a new array rather than `push()`.  A signal only notifies its readers when
it is *set* to a new value, so mutating the existing array in place would not trigger a re-render.

The finished class needs these imports:
```ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EntityQuery } from 'breeze-client';
import { Customer } from '../model/customer';
import { EntityManagerProvider } from '../entity-manager-provider';
```
and `FormsModule` added to the component's own `imports` array, which is where a standalone component declares
its dependencies:
```ts
@Component({
  selector: 'app-customer',
  imports: [FormsModule],
  templateUrl: './customer.component.html',
  styleUrl: './customer.component.css',
})
```

### Select a customer

Now we'll change the HTML template to allow selecting a customer from the list.

_NOTE: We are intentionally using a minimum of styling to keep things simple._

Edit `customer.component.html` and change the `table`.
Add a click event that sets the selected customer, and a style binding that highlights the selected line.

Add another table column that shows the state of each customer entity.
```html
<table>
  @for (cust of customers(); track cust) {
    <tr (click)="selected.set(cust)"
      [style.background-color]="selected() === cust ? 'lightgray' : 'white'">
      <td>{{cust.firstName}} {{cust.lastName}}</td>
      <td>{{cust.entityAspect.entityState}}</td>
    </tr>
  }
</table>
```
We use a direct `[style.background-color]` binding instead of the `ngStyle` directive, which saves importing
`CommonModule`.

Try it, and make sure the rows highlight when you click on them.

### Add a customer

Below the table, create an "Add" button that calls the `addCustomer` method in the component class.
```html
<button type="button" (click)="addCustomer()">Add</button>
```

### Edit customer properties

Below the "Add" button, create a set of inputs for editing the properties of the customer.

Use `@if` to only show this section if a customer is selected and the customer is not marked for deletion.

Also create a "Delete" button that calls the `delete` method in the component class.
```html
@if (selected(); as cust) {
  @if (!cust.entityAspect.entityState.isDeleted()) {
    <div>
      <h3>Edit</h3>
      <div>First Name: <input type="text" name="firstName" [(ngModel)]="cust.firstName"></div>
      <div>Last Name: <input type="text" name="lastName" [(ngModel)]="cust.lastName"></div>
      <div>City: <input type="text" name="city" [(ngModel)]="cust.city"></div>
      <div>Country: <input type="text" name="country" [(ngModel)]="cust.country"></div>
      <div>Phone: <input type="text" name="phone" [(ngModel)]="cust.phone"></div>
      <button type="button" (click)="delete(cust)">Delete</button>
    </div>
  }
}
```
The `@if (selected(); as cust)` form reads the signal once and gives the result a name, so the `[(ngModel)]`
bindings can write straight to the entity's properties - which is what puts the entity into the `Modified`
state.

### Save and Revert

Below the editing section, add a "Save Changes" button that calls the `saveChanges` method in the component class.

Add a "Revert Changes" button that calls the `rejectChanges` method in the component class.

Only show the buttons if there are changes to entities in the entity manager's cache.
```html
@if (manager.hasChanges()) {
  <div>
    <hr>
    <button type="button" (click)="saveChanges()">Save Changes</button>
    <button type="button" (click)="rejectChanges()">Revert Changes</button>
  </div>
}
```
`manager.hasChanges()` is an ordinary method call rather than a signal, and that is fine here: every action
that can change the answer is a template event handler, and event handlers schedule change detection even in a
zoneless app.

### Test the editing

Now you should be able to add a new Customer, edit the properties of new and existing customers, delete customers, and save
the changes in a batch.  (Remember that we only query customers where lastName starts with "C").

If you open your browser's developer tools (F12), you can see the network traffic between the Breeze client and the server API
as queries and saves are sent.

## A note on unit tests

`ng test` now runs [Vitest](https://vitest.dev) against a jsdom browser instead of Karma and Jasmine.  Two
things are worth knowing if you write component tests against Breeze:

- **Breeze registers an entity constructor with a single MetadataStore.**  Creating a fresh
  `EntityManagerProvider` in every `beforeEach` will fail on the second test with *"Cannot register the same
  constructor for Customer:#NorthwindModel.Models in different metadata stores"*.  Share one provider across
  the spec file and let `newManager()` give each test its own EntityManager.
- **In a zoneless test, `fixture.whenStable()` does not wait for Breeze's promises.**  Angular only knows
  about its own scheduler, so after flushing a mocked response you need to yield to the task queue
  (`await new Promise(resolve => setTimeout(resolve, 0))`) and then call `fixture.detectChanges()` before
  asserting against the DOM.  This applies only to tests; the running application repaints on its own.

See `src/app/customer/customer.component.spec.ts` in the sample for a worked example.

## What's different from the Angular 8 version

| | Angular 8 | Angular 22 |
|---|---|---|
| Bootstrap | `AppModule` + `platformBrowserDynamic` | standalone + `bootstrapApplication` |
| Configuration | `@NgModule` imports/providers | `app.config.ts` providers |
| Breeze adapter setup | `AppModule` constructor | `provideAppInitializer` |
| HttpClient | `HttpClientModule` | `provideHttpClient()` |
| Change detection | zone.js | zoneless; component state in signals |
| Template control flow | `*ngFor`, `*ngIf`, `ngStyle` | `@for`, `@if`, `[style.x]` |
| Dependency injection | constructor parameters | `inject()` |
| Environment files | `environment.ts` (dev) → `environment.prod.ts` | `environment.ts` (prod) → `environment.development.ts` |
| Base entity location | `src/app/model/base-entity.ts` | `src/app/base-entity.ts` |
| TypeScript | non-strict | strict by default (TS 6) |
| Unit tests | Karma + Jasmine | Vitest + jsdom |
| E2E tests | Protractor | none scaffolded |

The Breeze-specific pieces - `generate-entities.js`, the generated model, `EntityManagerProvider`, and the
query/save calls themselves - are essentially unchanged.

## Conclusion

We have come to the end of our journey.

We've created an Angular + Breeze application from the ground up,
using tools to create a simple entity model from the database for both the client and server parts of the application.

We now have an application that can create, read, update, and delete data.  It's ready for an improved UI,
and it's ready to be extended to cover more entity types and more complex use cases.
<hr>
If you have problems with this demo, please create issues in this github repo.

If you have questions about Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).
