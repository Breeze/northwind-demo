# Steps for creating a Breeze 3 Angular 22 App

Here are some steps to follow to create a new [Angular](https://angular.dev) 22 application, using
[Breeze 3](https://breeze.github.io/breeze-client-v3/) (`breeze-client` 3.0.0) to handle the data management.

We will assume that you've already got the server side created, following the outline described in the [STEPS](../STEPS.md) document.

For the client, we will start with an empty directory and build an application that
talks to the server, using Breeze to query and update data.

Along the way we will:

- Create an Angular application using the CLI
- Create TypeScript entity classes from the server metadata
- Create an Angular component to read and update entities
- Give the component a polished UI with the [Optimus UI](https://optimus.openng.org) component library
- Show each customer's orders, loading them on demand through a navigation property
- Create a second page, reached by a route with a parameter, that shows an order with its related entities
- Protect unsaved changes with a route guard and a confirmation dialog

> This is the Breeze 3 version of [STEPS-Client-Angular22](STEPS-Client-Angular22.md), which uses
> `breeze-client` 2.x and lives in the [northwind-angular22](northwind-angular22) directory.  The finished
> Breeze 3 app is in [northwind-angular22-v3](northwind-angular22-v3).  The Angular parts are the same up to
> the Optimus UI section; that section and the ones after it are new in this version.  The Breeze setup is
> simpler.  A summary of what
> changed is at the [end of this document](#whats-different-from-the-breeze-2-version).

# Create the Angular App

To create the initial shell of the Angular app, we will use the Angular CLI as instructed in the [Angular CLI Guide](https://angular.dev/installation).

First, make sure you have [nodejs](https://nodejs.org) and [npm](https://docs.npmjs.com/) installed.

**Angular 22 requires Node.js v22.22.3 or later** (or v24.15+, or v26+).  Older versions of Node - including
Node 22 releases earlier than 22.22.3 - will refuse to run the CLI with a message like:

```
Node.js version v22.14.0 detected.
The Angular CLI requires a minimum Node.js version of v22.22.3 or v24.15.0 or v26.0.0.
```

Check yours with `node --version` and upgrade if needed before continuing.  (Breeze 3 itself needs Node 20 or
later, so Angular is the stricter requirement.)  The sample includes an `.nvmrc` file that selects Node v24.15.0,
so if you use [nvm](https://github.com/nvm-sh/nvm) you can just run `nvm use` in the app directory.

Next, open a command prompt in the `client` directory, and follow the steps below:

1. `npx @angular/cli@22 new northwind-angular22-v3 --style=css --ssr=false`
  - The `--style=css` flag chooses plain CSS for the stylesheet format
  - The `--ssr=false` flag skips server-side rendering, which this demo does not need

Those two flags answer the only questions the CLI would otherwise ask, so the command runs without
prompting.  Note that there is no longer a prompt for routing - it is always configured now.

Now you should have a `client/northwind-angular22-v3` directory containing the Angular app.  Try it out:

`cd northwind-angular22-v3`
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

## Add Breeze

Now we'll add Breeze to the app, so we can query entities from the server and update them.

In the `northwind-angular22-v3` directory, run:

`npm install breeze-client`

That's the only package we need.  Breeze 3 has no runtime dependencies, and the entity generator is now
published inside `breeze-client` itself (as the `breeze-gen-entities` command), so the separate
`breeze-entity-generator` package is no longer used.

> Breeze 3 is **ESM only** - there is no CommonJS or UMD build.  That is no problem for an Angular 22 app,
> whose build is ESM throughout.

## Generate Entities

When developing our app, it's helpful to have TypeScript classes to represent the entity data that comes from the
server.  Breeze can generate them for us from the server's metadata.

In the Breeze 2 version we first wrote a `BaseEntity` class for the entities to extend.  **That step is gone.**
Breeze 3 provides `EntityBase` (and `ComplexObjectBase` for complex types), and the generated classes extend it
directly.

#### Get the metadata

The entity generator reads the same metadata that the app will load at runtime, so we keep a copy of it in the
app, at `src/app/model/metadata.json`.

You should already know how to generate a `metadata.json` file from the server.
If you don't, see the "Generate the metadata" topic in the server document.

To make it easy to refresh, add a script to the `scripts` section of `package.json` that runs the
[NorthwindNet10](../server/NorthwindNet10) server's metadata command and writes the result straight into the app:
```json
    "generate-metadata": "dotnet ../../server/NorthwindNet10/NorthwindServer/bin/Debug/net10.0/NorthwindServer.dll metadata > src/app/model/metadata.json"
```
Create the `src/app/model` directory, build the server, and then run:

`npm run generate-metadata`

_If you are using a different server, just copy its `metadata.json` file to `src/app/model/metadata.json` instead._

#### Generate entities from metadata

In the Breeze 2 version we had to write a `generate-entities.js` script to drive the generator.  Now it is a
single command.  Add another script to `package.json`:
```json
    "generate-entities": "breeze-gen-entities --metadata src/app/model/metadata.json --out src/app/model"
```
Then run it:

`npm run generate-entities`

This should create files in the `northwind-angular22-v3/src/app/model` directory, next to `metadata.json`:
```
customer.ts
index.ts
order-item.ts
order.ts
product.ts
supplier.ts
```
These are the entity classes, plus an `index.ts` that exports them all along with a `registerModelClasses`
function that we will use later.  There is no longer a generated `metadata.ts` or `registration-helper.ts`:
the metadata is imported directly from the JSON file, and `index.ts` takes the place of the registration helper.

Open `customer.ts` and look at the class:
```ts
import type { RelationArray } from 'breeze-client'; // @generated
import { EntityBase } from 'breeze-client'; // @generated
import type { Order } from './order'; // @generated

export class Customer extends EntityBase {
  declare id: number;  // @generated
  declare city: string;  // @generated
  declare country: string;  // @generated
  declare firstName: string;  // @generated
  declare lastName: string;  // @generated
  declare phone: string;  // @generated
  declare orders: RelationArray<Order>;  // @generated
}
```
A few things are different from the Breeze 2 output:

- The properties use **`declare`** rather than the `!` and `?` annotations.  `declare` tells TypeScript that the
  property exists without emitting any code for it, so the class never shadows the properties that Breeze
  defines on the entity at runtime.  It also satisfies TypeScript 6's strict mode.  If you want nullable
  properties typed as `string | null`, add `--nullable` to the generator command.
- Collection navigation properties are typed as **`RelationArray<T>`**, which is what Breeze actually puts there.
- Imports of other entity classes are `import type`, so the classes don't import each other at runtime.

#### Regenerating

You can rerun `npm run generate-entities` whenever the metadata changes.  The generator updates the files
**in place**, one property at a time: properties that are in the metadata are rewritten (and marked
`// @generated`), new ones are added, and ones that have left the metadata are removed.  Anything else you add to
a class - methods, getters, constructors, unmapped properties, imports - is left alone.  So, unlike the Breeze 2
generator, there are no special `<code>` regions to write your code in.

To protect something the generator would otherwise rewrite, mark it with `// @manual` (one declaration),
`// @manual-start` ... `// @manual-end` (a block), or `// @manual-file` (the whole file).

Run `npx breeze-gen-entities --help` to see the other options, such as `--base` to give all of the entities a
base class of your own.

## Configure the application

Now we need to configure Breeze to work with Angular.

Breeze 3 needs much less configuration than Breeze 2.  The adapters that we used to register one by one -
`ModelLibraryBackingStoreAdapter`, `UriBuilderJsonAdapter`, `DataServiceWebApiAdapter` - are now the defaults,
and `NamingConvention.camelCase` is now the default naming convention.  There is no ajax adapter any more: Breeze
sends its HTTP requests through a `fetch` function, which defaults to the browser's `fetch`.

That means a Breeze 3 app talking to a Breeze .NET server **needs no configuration at all**.  We'll add one
line anyway, so that Breeze sends its requests through Angular's `HttpClient`.  That way they pass through any
HTTP interceptors the app adds later (for authentication headers, for instance), and they can be mocked with
`HttpTestingController` in unit tests.

We still configure Breeze in an **app initializer**, which runs once during bootstrap - before any component can
ask for an `EntityManager`.

Edit `northwind-angular22-v3/src/app/app.config.ts` and replace the contents with:
```ts
import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { configureBreeze } from 'breeze-client';
import { httpClientFetch } from 'breeze-client/adapter-angular-httpclient';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Configure Breeze before anything creates an EntityManager.
    // This is the standalone equivalent of the AppModule constructor.
    provideAppInitializer(() => {
      const http = inject(HttpClient);
      configureBreeze({ fetch: httpClientFetch(http) });
    }),
  ],
};
```
`configureBreeze` is Breeze 3's single, typed configuration call.  Every option is optional:

 - `fetch` - the function Breeze makes every HTTP request with.  `httpClientFetch(http)` wraps Angular's `HttpClient`
 - `namingConvention` - how Breeze converts property names between client and server.  The default is
   `NamingConvention.camelCase`; use `NamingConvention.none` if your server already sends camel-cased names
 - `modelLibrary`, `uriBuilder`, `dataService` - replace one of the default adapters

`httpClientFetch` comes from `breeze-client/adapter-angular-httpclient`, the Breeze 3 replacement for
`breeze-client/adapter-ajax-httpclient`.  It is kept in its own entry point so that Angular stays out of the core
Breeze build.  It also takes care of an `HttpClient` quirk: `HttpClient` throws on an error status, but Breeze
needs the error response's body to report validation errors from a failed save, so `httpClientFetch` hands the
response to Breeze anyway.

Since the adapters are no longer registered by hand, there is also no longer a registration order to get right.

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

In a Breeze application, the [EntityManager](https://breeze.github.io/breeze-client-v3/) caches the
entities and keeps track of the changes.  You may need more than one, if you want to keep multiple change sets.  To make
it easy, we will create a service called the EntityManagerProvider.

Create the file `northwind-angular22-v3/src/app/entity-manager-provider.ts`.  In the file, put:
```ts
import { Injectable } from '@angular/core';
import { DataService, EntityManager } from 'breeze-client';
import { environment } from '../environments/environment';
import { registerModelClasses } from './model';
import metadata from './model/metadata.json';

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
    metadataStore.importMetadata(metadata);
    registerModelClasses(metadataStore);
  }

  newManager(): EntityManager {
    return this.masterManager.createEmptyCopy();
  }
}
```
This code creates a new "master" manager and configures its metadata.
It exposes a `newManager()` method that creates a copy of the master complete with metadata.
When we need an EntityManager, we call the `newManager()` method.

Only two lines differ from the Breeze 2 version:

- The metadata is **imported straight from `metadata.json`**, rather than from a generated `metadata.ts` that
  wrapped the same JSON in a string.  No extra configuration is needed for the JSON import: the CLI's
  `tsconfig.json` uses `"module": "preserve"`, which turns on `resolveJsonModule`.
- `registerModelClasses` (from the generated `model/index.ts`) replaces `NorthwindRegistrationHelper.register`.
  It tells the MetadataStore to use our generated classes when it creates `Customer`, `Order`, and the other
  entities.

## Create the Customer component

Now create a component to display some customer data.  Open a command prompt in the `northwind-angular22-v3` directory, and execute the command:

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

From here on, the code is **exactly the same as in the Breeze 2 version**: Breeze 3 kept the same public API for
querying, creating, editing, and saving entities.

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

Try it now: if the app is not already running, open a command prompt in the `northwind-angular22-v3` directory and run:

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

> **Zoneless Angular needs signals here.**  With no zone.js, a plain field assignment like
> `this.customers = qr.results` would update the data but never repaint the screen.  Holding the list in a
> `signal` and calling `.set()` is what tells Angular to re-render.
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

`Customer.prototype.entityType` works because `registerModelClasses` attached the `Customer` class to the
metadata.  The `entityType` and `entityAspect` properties now come from Breeze's `EntityBase` rather than from a
base class of our own.

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

## Improve the UI with Optimus UI

The app works, but it doesn't look like much.  Now we'll replace the plain HTML with components from
[Optimus UI](https://optimus.openng.org), an open source (MIT) library of Angular UI components.  When we're
done, the screen will have two panels side by side:

 - A **Customers** panel holding a table of customers, with a coloured tag showing each customer's entity state,
   and Add, Save Changes and Revert Changes buttons in its footer
 - An **Edit Customer** panel holding the editing form, with a Delete button in its footer

None of the Breeze code changes.  The component class gets two small helper methods, and the template is
rewritten to use Optimus UI components.

_Optimus UI documentation, including an LLM-friendly version at
[optimus.openng.org/llms/llms.txt](https://optimus.openng.org/llms/llms.txt), is at
[optimus.openng.org](https://optimus.openng.org)._

### Install Optimus UI

In the `northwind-angular22-v3` directory, run:

`npm install @openng/optimus-ui @openng/optimus-ui-themes @openng/icons @angular/cdk`

 - `@openng/optimus-ui` is the component library.  Version 2.x targets Angular 22
 - `@openng/optimus-ui-themes` holds the pre-built themes
 - `@openng/icons` is the icon font that the components and the examples use (the `pi pi-*` classes)
 - `@angular/cdk` is a peer dependency of Optimus UI.  It isn't installed with a new Angular app, so we add it

_The CLI can do this step and the next for you with `ng add @openng/optimus-ui`, which asks which theme to use.
We do it by hand here so you can see what changes._

### Configure Optimus UI

Optimus UI is configured with a provider.  Edit `app.config.ts` and add two imports:
```ts
import { provideOptimus } from '@openng/optimus-ui/config';
import Aura from '@openng/optimus-ui-themes/aura';
```
Then add `provideOptimus` to the `providers` array, after `provideHttpClient()`:
```ts
    provideOptimus({ theme: { preset: Aura } }),
```
This selects the Aura theme.  The other themes are `lara`, `material` and `nora`.

The theme follows the system's light/dark setting by default.  It does that by setting CSS variables (named
`--p-*`) that the components use, and we can use them too.

Next, add the icon stylesheet to the build.  In `angular.json`, find the `styles` array in the `build` options and
put the icon CSS ahead of the app's own stylesheet:
```json
            "styles": ["@openng/icons/openng-icons.css", "src/styles.css"]
```

Finally, give the page itself a background and text colour that match the theme, in both light and dark mode.
Replace the contents of `src/styles.css` with:
```css
/* Optimus UI follows the system light/dark setting, so let the page do the same. */
:root {
  color-scheme: light dark;
}

body {
  margin: 0;
  padding: 1.5rem;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--p-text-color);
  background: light-dark(var(--p-surface-100), var(--p-surface-950));
}

h1 {
  margin: 0 0 1.5rem;
  font-weight: 600;
}
```
`light-dark()` picks the first colour in light mode and the second in dark mode.  It works because `:root`
declares that the page supports both colour schemes.

### Raise the bundle budget

Optimus UI's Table is a large component, and with it the initial bundle grows to about 1.25 MB (250 kB
compressed).  That is over the 1 MB limit the CLI sets on a new app, so `ng build` would fail.  For this demo we
simply raise the limit.  In `angular.json`, find the `budgets` in the `production` configuration and change the
`initial` budget:
```json
                {
                  "type": "initial",
                  "maximumWarning": "1.5MB",
                  "maximumError": "2MB"
                },
```

### Import the components

Each Optimus UI component is imported on its own, so you only include what you use.  Edit
`customer.component.ts` and add these imports:
```ts
import { ButtonModule } from '@openng/optimus-ui/button';
import { IftaLabelModule } from '@openng/optimus-ui/iftalabel';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { PanelModule } from '@openng/optimus-ui/panel';
import { TableModule } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';
```
Then add them to the component's `imports` array, next to `FormsModule`:
```ts
@Component({
  selector: 'app-customer',
  imports: [FormsModule, ButtonModule, IftaLabelModule, InputTextModule, PanelModule, TableModule, TagModule],
  templateUrl: './customer.component.html',
  styleUrl: './customer.component.css',
})
```

Also add two helper methods to the class, after `rejectChanges`:
```ts
  canDelete() {
    const cust = this.selected();
    return !!cust && !cust.entityAspect.entityState.isDeleted();
  }

  // Color for the entity state tag in the customer list
  stateSeverity(cust: Customer) {
    const state = cust.entityAspect.entityState;
    if (state.isAdded()) return 'success';
    if (state.isModified()) return 'warn';
    if (state.isDeleted()) return 'danger';
    return 'secondary';
  }
```
`canDelete` enables the Delete button.  `stateSeverity` picks the colour of the tag that shows each
customer's entity state: green for Added, amber for Modified, red for Deleted, and grey for Unchanged.

### Rewrite the template

Replace the whole of `customer.component.html` with the version below.  We'll go through it piece by piece
afterwards.
```html
<div class="layout">
  <p-panel header="Customers">
    <p-table [value]="customers()" dataKey="id" selectionMode="single"
      [selection]="selected()" (selectionChange)="selected.set($event ?? undefined)"
      size="small" [rowHover]="true">
      <ng-template #header>
        <tr>
          <th>Name</th>
          <th>City</th>
          <th>Country</th>
          <th>State</th>
        </tr>
      </ng-template>
      <ng-template #body let-cust>
        <tr [pSelectableRow]="cust">
          <td>{{cust.firstName}} {{cust.lastName}}</td>
          <td>{{cust.city}}</td>
          <td>{{cust.country}}</td>
          <td>
            <p-tag [value]="cust.entityAspect.entityState.name" [severity]="stateSeverity(cust)" />
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="4">No customers found.</td>
        </tr>
      </ng-template>
    </p-table>

    <ng-template #footer>
      <div class="actions">
        <p-button label="Add" icon="pi pi-plus" severity="secondary" (onClick)="addCustomer()" />
        <span class="spacer"></span>
        @if (manager.hasChanges()) {
          <p-button label="Revert Changes" icon="pi pi-undo" severity="secondary" [outlined]="true" (onClick)="rejectChanges()" />
          <p-button label="Save Changes" icon="pi pi-save" (onClick)="saveChanges()" />
        }
      </div>
    </ng-template>
  </p-panel>

  <p-panel header="Edit Customer">
    @if (selected(); as cust) {
      @if (!cust.entityAspect.entityState.isDeleted()) {
        <div class="form">
          <p-iftalabel>
            <input pInputText id="firstName" name="firstName" [(ngModel)]="cust.firstName" autocomplete="off" fluid />
            <label for="firstName">First Name</label>
          </p-iftalabel>
          <p-iftalabel>
            <input pInputText id="lastName" name="lastName" [(ngModel)]="cust.lastName" autocomplete="off" fluid />
            <label for="lastName">Last Name</label>
          </p-iftalabel>
          <p-iftalabel>
            <input pInputText id="city" name="city" [(ngModel)]="cust.city" autocomplete="off" fluid />
            <label for="city">City</label>
          </p-iftalabel>
          <p-iftalabel>
            <input pInputText id="country" name="country" [(ngModel)]="cust.country" autocomplete="off" fluid />
            <label for="country">Country</label>
          </p-iftalabel>
          <p-iftalabel>
            <input pInputText id="phone" name="phone" [(ngModel)]="cust.phone" autocomplete="off" fluid />
            <label for="phone">Phone</label>
          </p-iftalabel>
        </div>
      } @else {
        <p class="hint">This customer will be deleted when you save changes.</p>
      }
    } @else {
      <p class="hint">Select a customer to edit.</p>
    }

    <ng-template #footer>
      <div class="actions">
        <p-button label="Delete" icon="pi pi-trash" severity="danger" [outlined]="true"
          [disabled]="!canDelete()" (onClick)="delete(selected()!)" />
      </div>
    </ng-template>
  </p-panel>
</div>
```
We've also dropped the "customer works!" line.

#### The panels

`<p-panel>` is a container with a header.  The `header` attribute sets its title, and an
`<ng-template #footer>` inside it fills its footer, which is where we put the buttons.

#### The table

`<p-table>` replaces our `@for` loop.  It takes the list in `[value]`, and renders it with two templates:
`#header` for the column headings, and `#body` for one row, which receives each customer as `let-cust`.  The
`#emptymessage` template is shown when the list is empty.

Selection is now handled by the table instead of our own `(click)` handler and background-colour binding:

 - `selectionMode="single"` turns on row selection, and `[pSelectableRow]="cust"` makes each row selectable.
   The table highlights the selected row itself
 - `[selection]` and `(selectionChange)` connect the table's selection to our `selected` signal.  We don't use
   the `[(selection)]` two-way shorthand because `selected` is a signal: the table reads it with `selected()` and
   writes it with `selected.set(...)`.  The table emits `null` when nothing is selected, so `?? undefined` keeps
   the signal's type as `Customer | undefined`
 - `dataKey="id"` tells the table to compare rows by their `id` key.  This matters with Breeze entities: without
   a `dataKey` the table compares rows by deep equality, which is slow and would walk into each entity's
   navigation properties and `entityAspect`

`size="small"` makes the rows more compact, and `[rowHover]="true"` highlights the row under the mouse.

The entity state column now uses `<p-tag>`, a small coloured label, with the colour from `stateSeverity`.

#### The form

Each input is now an `<input pInputText>`, which styles a native input to match the theme.  Since it is still a
plain `<input>`, `[(ngModel)]` binds it to the entity property exactly as before.  The `fluid` attribute makes
it fill the width of the panel.

Each input is wrapped in `<p-iftalabel>` ("in-field top-aligned label") with a `<label>` after it.  That puts the
label inside the input box, above the value.  The `for` on the label must match the `id` on the input.

When no customer is selected, or the selected customer has been deleted, the panel shows a hint instead of the
form.

#### The buttons

`<p-button>` uses `label` for its text, `icon` for an icon from `@openng/icons`, and `severity` for its
colour.  `[outlined]="true"` gives a lighter, outlined style for the less important actions.

Notice that the click event is **`(onClick)`**, not `(click)`.  `(onClick)` is the event the Button
component emits, and it isn't emitted when the button is disabled.

### Lay out the panels

Last, add some styles to put the panels side by side and space out their contents.  Replace the contents of
`customer.component.css` with:
```css
.layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.spacer {
  flex: 1;
}

.hint {
  margin: 0;
  color: var(--p-text-muted-color);
}
```
The customer list gets two thirds of the width and the edit panel one third; on a narrow screen the panels stack.
The `.spacer` pushes Save and Revert to the right-hand end of the Customers footer, away from Add.

_The Optimus UI examples use [Tailwind CSS](https://optimus.openng.org/tailwind) utility classes such as
`flex` and `gap-2` for layout.  This app doesn't use Tailwind, so we write the few styles we need ourselves._

### Try it out

Run `ng serve --open` again, with the server running.  You should see the Customers and Edit Customer panels.
Everything works as before: click a row to select a customer, edit it in the form, and watch its state tag
change from Unchanged to Modified.  Add, delete, save and revert all work the same way.

## Show the customer's orders

So far we've only worked with one entity type.  Now we'll use Breeze's navigation properties to show the orders of
the selected customer, in a third panel below the other two.

Each `Customer` has an `orders` property, but our query didn't fetch them: it only asked for customers.  We could
have added `.expand('orders')` to the query to fetch every customer's orders up front, but it's more efficient to
fetch the orders of a customer only when the user selects that customer.  Breeze does that with
`entityAspect.loadNavigationProperty('orders')`, which queries the server for the orders whose `customerId` matches
the customer, adds them to the EntityManager's cache, and so fills in `customer.orders`.

Breeze also remembers that it has loaded the property, so `entityAspect.isNavigationPropertyLoaded('orders')` lets
us skip the query the next time the same customer is selected.

### Change the component class

Edit `customer.component.ts`.  Add an import for the `Order` class and for Angular's date and currency pipes:
```ts
import { CurrencyPipe, DatePipe } from '@angular/common';
...
import { Order } from '../model/order';
```
and add `CurrencyPipe` and `DatePipe` to the component's `imports` array:
```ts
  imports: [CurrencyPipe, DatePipe, FormsModule, ButtonModule, IftaLabelModule, InputTextModule, PanelModule, TableModule, TagModule],
```

Add two signals, for the orders to display and for whether they are still loading:
```ts
  readonly orders = signal<Order[]>([]);
  readonly ordersLoading = signal(false);
```

Selecting a customer now has to load that customer's orders too, so add a `select` method for the table to call
instead of setting `selected` directly, and a `loadOrders` method that does the work:
```ts
  select(cust: Customer | undefined) {
    this.selected.set(cust);
    this.loadOrders(cust);
  }

  // Show the customer's orders.  They are queried from the server the first time
  // the customer is selected; after that, Breeze has them in its cache.
  private loadOrders(cust: Customer | undefined) {
    this.ordersLoading.set(false);
    if (!cust) {
      this.orders.set([]);
      return;
    }
    const aspect = cust.entityAspect;
    if (aspect.entityState.isAdded() || aspect.isNavigationPropertyLoaded('orders')) {
      this.orders.set([...cust.orders]);
      return;
    }
    this.orders.set([]);
    this.ordersLoading.set(true);
    aspect.loadNavigationProperty('orders').finally(() => {
      // ignore the result if another customer was selected in the meantime
      if (this.selected() === cust) {
        this.orders.set([...cust.orders]);
        this.ordersLoading.set(false);
      }
    });
  }
```
A few things to note:

 - A customer we just added (`isAdded()`) doesn't exist on the server yet, so there is nothing to query
 - `cust.orders` is a Breeze `RelationArray` that Breeze updates in place.  We copy it into a new array with
   `[...cust.orders]` so that setting the signal gives the table a new value
 - The user can click another customer before the query returns.  Checking `this.selected() === cust` makes sure
   a late result doesn't overwrite the orders of the customer that is now selected

`addCustomer` should select the new customer the same way, so change its `this.selected.set(cust)` to:
```ts
    this.select(cust);
```

Finally, add a method for the title of the new panel:
```ts
  ordersHeader() {
    const cust = this.selected();
    return cust ? `Orders for ${cust.firstName ?? ''} ${cust.lastName ?? ''}` : 'Orders';
  }
```
The `?? ''` keeps "undefined" out of the title while a new customer's name is still blank.

### Change the template

In `customer.component.html`, change the customer table's `(selectionChange)` to call `select`.  While we're
there, give the table a class, so that it is easy to tell apart from the orders table in unit tests:
```html
    <p-table class="customers" [value]="customers()" dataKey="id" selectionMode="single"
      [selection]="selected()" (selectionChange)="select($event ?? undefined)"
      size="small" [rowHover]="true">
```

Then add a third panel, just before the closing `</div>` of the layout:
```html
  <p-panel class="orders-panel" [header]="ordersHeader()">
    <p-table class="orders" [value]="orders()" [loading]="ordersLoading()" dataKey="id" size="small">
      <ng-template #header>
        <tr>
          <th>Order Number</th>
          <th>Order Date</th>
          <th class="amount">Total Amount</th>
        </tr>
      </ng-template>
      <ng-template #body let-order>
        <tr>
          <td>{{order.orderNumber}}</td>
          <td>{{order.orderDate | date}}</td>
          <td class="amount">{{order.totalAmount | currency}}</td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="3">{{ selected() ? 'No orders.' : 'Select a customer to see their orders.' }}</td>
        </tr>
      </ng-template>
    </p-table>
  </p-panel>
```
`[loading]` shows a spinner over the table while the orders are being fetched.  The `date` and `currency` pipes
format the order date and total amount.

### Lay out the orders panel

In `customer.component.css`, add these rules after the `.layout` rule, so the orders panel spans the full width
below the other two panels, and the amounts line up on the right:
```css
.orders-panel {
  grid-column: 1 / -1;
}

.amount {
  text-align: right;
}
```

Try it: select a customer, and you should see that customer's orders.  In the browser's network tab, you'll see a
request to `Orders` the first time you select each customer, and none when you select the customer again.

## Create the Order component

Next we'll add a second page that shows one order in detail: the order and its customer in one panel, and the
order's items, with their products and suppliers, in another.  Clicking an order number in the customer page will
open it, with the order id in the URL, for example `/orders/1`.

In the `northwind-angular22-v3` directory, run:

`ng generate component order --type=component`

### Query the order and its related entities

This time we know up front that we want the related entities, so we fetch them all in a single query with
`expand`.  The expand path `orderItems.product.supplier` follows the navigation properties from each order item to
its product, and from each product to its supplier.

Replace the contents of `order.component.ts` with:
```ts
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';
import { PanelModule } from '@openng/optimus-ui/panel';
import { TableModule } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';
import { EntityQuery } from 'breeze-client';
import { Order } from '../model/order';
import { OrderItem } from '../model/order-item';
import { EntityManagerProvider } from '../entity-manager-provider';

@Component({
  selector: 'app-order',
  imports: [CurrencyPipe, DatePipe, RouterLink, ButtonModule, PanelModule, TableModule, TagModule],
  templateUrl: './order.component.html',
  styleUrl: './order.component.css',
})
export class OrderComponent implements OnInit {

  /** The order id, bound from the `orders/:id` route parameter. */
  readonly id = input.required<string>();

  readonly manager = inject(EntityManagerProvider).newManager();
  readonly order = signal<Order | undefined>(undefined);
  readonly orderItems = signal<OrderItem[]>([]);
  readonly loading = signal(true);

  ngOnInit() {
    // Get the order, its customer, and its items with their products and suppliers, in one query
    const query = new EntityQuery('Orders')
      .where('id', '==', Number(this.id()))
      .expand('customer, orderItems.product.supplier');
    this.manager.executeQuery(query).then(qr => {
      const order = qr.results[0] as Order | undefined;
      this.order.set(order);
      this.orderItems.set(order ? [...order.orderItems] : []);
    }).finally(() => {
      this.loading.set(false);
    });
  }

  lineTotal(item: OrderItem) {
    return item.unitPrice * item.quantity;
  }
}
```
The order id comes from the URL.  The `id` **input** receives it from the router, which we'll set up below.  It
is a string, like all route parameters, so we convert it with `Number()` before comparing it with the numeric `id`
property.

As with the customer list, we use the client-side, camel-cased property names in the query.  Breeze sends the
server's names, so the request looks like this:
```
/api/breeze/Orders?{"where":{"Id":1},"expand":["Customer","OrderItems.Product.Supplier"]}
```
The response contains the order with its customer and items, and each item's product and supplier.  Breeze puts
all of them in the cache and connects them, so in the template we can simply write
`item.product.supplier.companyName`.

The component has its own EntityManager, so it always fetches a fresh copy of the order.

### The template

Replace the contents of `order.component.html` with:
```html
<div class="toolbar">
  <p-button label="Customers" icon="pi pi-arrow-left" severity="secondary" [text]="true" routerLink="/customers" />
</div>

@if (order(); as order) {
  <div class="layout">
    <p-panel [header]="'Order ' + order.orderNumber">
      <div class="details">
        <section>
          <h3>Order</h3>
          <dl>
            <dt>Order Number</dt>
            <dd>{{order.orderNumber}}</dd>
            <dt>Order Date</dt>
            <dd>{{order.orderDate | date}}</dd>
            <dt>Total Amount</dt>
            <dd>{{order.totalAmount | currency}}</dd>
          </dl>
        </section>
        <section>
          <h3>Customer</h3>
          <dl>
            <dt>Name</dt>
            <dd>{{order.customer.firstName}} {{order.customer.lastName}}</dd>
            <dt>City</dt>
            <dd>{{order.customer.city}}</dd>
            <dt>Country</dt>
            <dd>{{order.customer.country}}</dd>
            <dt>Phone</dt>
            <dd>{{order.customer.phone}}</dd>
          </dl>
        </section>
      </div>
    </p-panel>

    <p-panel header="Order Items">
      <p-table class="order-items" [value]="orderItems()" dataKey="id" size="small">
        <ng-template #header>
          <tr>
            <th>Product</th>
            <th>Package</th>
            <th>Supplier</th>
            <th class="number">Unit Price</th>
            <th class="number">Quantity</th>
            <th class="number">Total</th>
          </tr>
        </ng-template>
        <ng-template #body let-item>
          <tr>
            <td>
              {{item.product.productName}}
              @if (item.product.isDiscontinued) {
                <p-tag value="Discontinued" severity="warn" />
              }
            </td>
            <td>{{item.product.package}}</td>
            <td>{{item.product.supplier.companyName}}</td>
            <td class="number">{{item.unitPrice | currency}}</td>
            <td class="number">{{item.quantity}}</td>
            <td class="number">{{lineTotal(item) | currency}}</td>
          </tr>
        </ng-template>
        <ng-template #footer>
          <tr>
            <td colspan="5">Total</td>
            <td class="number">{{order.totalAmount | currency}}</td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="6">This order has no items.</td>
          </tr>
        </ng-template>
      </p-table>
    </p-panel>
  </div>
} @else {
  <p-panel header="Order">
    <p class="hint">{{ loading() ? 'Loading order...' : 'Order ' + id() + ' was not found.' }}</p>
  </p-panel>
}
```
Things to note:

 - The "Customers" button at the top uses `routerLink` to go back to the customer page.  `routerLink` works on any
   element, including an Optimus UI button
 - The first panel's header shows the order number, and the panel shows the order's fields and the customer's
   fields side by side, as two definition lists
 - In the items table, the Unit Price is the order item's `unitPrice` - the price the customer paid - rather than
   the product's current `unitPrice`.  Discontinued products get a "Discontinued" tag
 - The `#footer` template adds a totals row at the bottom of the table
 - Until the query returns, and if no order has that id, the page shows a single panel with a message instead

### The styles

Replace the contents of `order.component.css` with:
```css
.toolbar {
  margin-bottom: 1rem;
}

.layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.details {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem 4rem;
}

h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
}

dl {
  display: grid;
  grid-template-columns: max-content auto;
  gap: 0.5rem 1.5rem;
  margin: 0;
}

dt {
  color: var(--p-text-muted-color);
}

dd {
  margin: 0;
}

.number {
  text-align: right;
}

.hint {
  margin: 0;
  color: var(--p-text-muted-color);
}

td p-tag {
  margin-left: 0.5rem;
}
```
The `dl` grid puts each label (`dt`) beside its value (`dd`).

### Add the route

Edit `app.routes.ts`, import the `OrderComponent`, and add a route for it before the `**` route:
```ts
import { OrderComponent } from './order/order.component';
...
  {
    path: 'orders/:id',
    component: OrderComponent,
  },
```
The `:id` in the path is a route parameter.  To have the router pass it to the component's `id` input, turn on
**component input binding** in `app.config.ts`.  Change the router import and the `provideRouter` call to:
```ts
import { provideRouter, withComponentInputBinding } from '@angular/router';
...
    provideRouter(routes, withComponentInputBinding()),
```
Without it, the component would have to inject `ActivatedRoute` and read the parameter itself.

### Link to the order from the customer page

In `customer.component.html`, change the order number cell of the orders table into a link:
```html
          <td><a [routerLink]="['/orders', order.id]">{{order.orderNumber}}</a></td>
```
and in `customer.component.ts`, import `RouterLink` and add it to the component's `imports` array:
```ts
import { RouterLink } from '@angular/router';
...
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, ButtonModule, IftaLabelModule, InputTextModule, PanelModule, TableModule, TagModule],
```

Last, give links the theme's primary colour by adding this to `src/styles.css`:
```css
a {
  color: var(--p-primary-color);
}
```

Try it: select a customer, click one of the order numbers, and you should see the order page.  Click "Customers" to
go back.

## Protect unsaved changes

There is a problem with the new page.  Each page has its own EntityManager, so when we go from the customer page
to an order, the customer page - and its EntityManager, with any unsaved changes - is thrown away.  Coming back
creates a fresh one, which queries the customers again.

So before the user leaves the customer page with unsaved changes, we'll ask them, in a popup dialog, whether to
discard the changes or stay on the page.  Angular has a hook for exactly this: a **`CanDeactivate` guard**, which
the router calls before leaving a route.  It can allow the navigation or cancel it, and it can take its time
deciding, by returning a promise.  We'll show the dialog with the Optimus UI **ConfirmDialog** component.

### Add the confirm dialog

A ConfirmDialog is opened through the `ConfirmationService`.  Since any page might need it, we'll put one dialog in
the app shell and provide the service for the whole app.

In `app.config.ts`, import the service:
```ts
import { ConfirmationService } from '@openng/optimus-ui/api';
```
and add it to the `providers`, after `provideOptimus`:
```ts
    // Used to open the p-confirmdialog in app.html
    ConfirmationService,
```

Add the dialog at the end of `app.html`:
```html
<h1>Northwind</h1>
<router-outlet></router-outlet>
<p-confirmdialog />
```
and import its module in `app.ts`:
```ts
import { ConfirmDialogModule } from '@openng/optimus-ui/confirmdialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
```

### Create the guard

Create the file `src/app/unsaved-changes.guard.ts`:
```ts
import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmationService } from '@openng/optimus-ui/api';

/** A routed component whose EntityManager may hold changes that have not been saved. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Before leaving a route, ask the user whether to discard unsaved changes.
 * Discarding lets the navigation proceed; the component's EntityManager, and its
 * changes, go away with the component.  Cancelling (or closing the dialog) stays put.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  const confirmationService = inject(ConfirmationService);
  return new Promise<boolean>(resolve => {
    confirmationService.confirm({
      header: 'Unsaved Changes',
      message: 'You have changes that have not been saved. Do you want to discard them?',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Discard Changes', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      accept: () => resolve(true),
      reject: () => resolve(false),
    });
  });
};
```
The router passes the guard the component that is about to be left.  The guard doesn't know anything about
customers: it works with any component that has a `hasUnsavedChanges()` method, described by the
`HasUnsavedChanges` interface.

If there are no changes, the guard returns `true` and the navigation goes ahead.  Otherwise it opens the dialog,
and returns a promise that resolves when the user answers: `true` (leave) for "Discard Changes", or `false` (stay)
for "Cancel".  The ConfirmDialog also calls `reject` when the user closes the dialog with its close button or the
Escape key, so those count as "Cancel".

The guard doesn't need to call `rejectChanges()` to discard the changes: once the user leaves, the component and
its EntityManager are destroyed, and the changes with them.

### Use the guard

In `app.routes.ts`, import the guard and add it to the `customers` route:
```ts
import { unsavedChangesGuard } from './unsaved-changes.guard';
...
  {
    path: 'customers',
    component: CustomerComponent,
    canDeactivate: [unsavedChangesGuard],
  },
```
The order page has nothing to save, so it doesn't need the guard.

Then make the `CustomerComponent` implement the interface.  In `customer.component.ts`, import it:
```ts
import { HasUnsavedChanges } from '../unsaved-changes.guard';
```
add it to the class declaration:
```ts
export class CustomerComponent implements OnInit, HasUnsavedChanges {
```
and add the method, which simply asks the EntityManager:
```ts
  // Checked by unsavedChangesGuard before the router leaves this page
  hasUnsavedChanges() {
    return this.manager.hasChanges();
  }
```

### Reloading and closing the tab

The router only knows about navigation inside the app.  If the user reloads the page, closes the tab, or goes to
another site, the changes would still be lost without warning.  Browsers don't allow a custom dialog in that
situation, but they will show their own "Leave site?" prompt if the page cancels the `beforeunload` event.

In `customer.component.ts`, add a `host` listener to the `@Component` decorator:
```ts
@Component({
  selector: 'app-customer',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, ButtonModule, IftaLabelModule, InputTextModule, PanelModule, TableModule, TagModule],
  templateUrl: './customer.component.html',
  styleUrl: './customer.component.css',
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
```
and the method it calls:
```ts
  // The router can't stop the browser from reloading or closing the tab, so ask
  // the browser to show its own "leave site?" prompt instead.
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }
```
The `host` property is the current way to listen to events on the component's host element, or, with the
`window:` prefix, on the window.  It replaces the `@HostListener` decorator.

### Try it out

Edit a customer, then click one of the order numbers.  You should see the "Unsaved Changes" dialog.  Click
"Cancel", and you stay on the customer page with your changes intact.  Click the order number again and choose
"Discard Changes", and the order page opens.  Back on the customer page, the changes are gone.

With unsaved changes, try reloading the page too: the browser asks whether you want to leave.

## A note on unit tests

`ng test` runs [Vitest](https://vitest.dev) against a jsdom browser.  These things are worth knowing if you
write component tests against Breeze and Optimus UI.  The sample's spec files - `customer.component.spec.ts`,
`order.component.spec.ts` and `unsaved-changes.guard.spec.ts` - show each of them in use.

- **The app initializer does not run in a component test**, so configure Breeze yourself in `beforeEach`, after
  `TestBed.configureTestingModule`.  Passing the test's `HttpClient` points Breeze at the
  `HttpTestingController` backend, so you can answer its requests with `expectOne(...).flush(...)`:
  ```ts
  import { configureBreeze } from 'breeze-client';
  import { httpClientFetch } from 'breeze-client/adapter-angular-httpclient';
  ...
    configureBreeze({ fetch: httpClientFetch(TestBed.inject(HttpClient)) });
  ```
  This one call replaces the four `register()` calls and the `NamingConvention` call of the Breeze 2 spec.
- **Breeze registers an entity class with a single MetadataStore.**  Creating a fresh
  `EntityManagerProvider` in every `beforeEach` will fail on the second test, because `registerModelClasses`
  would attach the same classes to a second store.  Share one provider across the spec file and let
  `newManager()` give each test its own EntityManager.  (Each spec file gets its own copy of the classes, so
  each file can have its own shared provider.)
- **In a zoneless test, `fixture.whenStable()` does not wait for Breeze's promises.**  Angular only knows
  about its own scheduler, so after flushing a mocked response you need to yield to the task queue
  (`await new Promise(resolve => setTimeout(resolve, 0))`) and then call `fixture.detectChanges()` before
  asserting against the DOM.  This applies only to tests; the running application repaints on its own.
- **`<p-table>` renders its header row inside the same `<table>` as the data rows**, and the customer page
  has two tables.  To find the customer rows in a test, query `.customers tbody tr` (using the class we gave the
  table) rather than `table tr`.  Clicking one of those rows selects it through the table, just as it does in
  the browser, so a test can select a customer and then edit the form.
- **Selecting a customer sends a request for its orders.**  `HttpTestingController.verify()` fails a test that
  leaves a request unanswered, so a test that selects a customer must answer it, for example with
  `httpMock.expectOne(r => r.url.startsWith('http://localhost:4000/api/breeze/Orders')).flush([])`.
- **Breeze sends the server's property names.**  To check the order page's query, look for
  `{"where":{"Id":11},"expand":["Customer","OrderItems.Product.Supplier"]}` in the request URL - not the
  camel-cased names used in the component.
- **Components with a `routerLink` need a router.**  Add `provideRouter([])` to the test's providers.
- **Route parameters are inputs.**  The router isn't involved in a component test, so set the order id with
  `fixture.componentRef.setInput('id', '11')` before the first change detection.
- **The confirm dialog needs `ConfirmationService`.**  Provide it in any test that renders `App`, which contains
  the `<p-confirmdialog>`.  To test a guard on its own, call it inside `TestBed.runInInjectionContext()` so that it
  can `inject()` the service.  The dialog is attached to the document body, so look for its buttons in
  `document`, not in the fixture.

## What's different from the Breeze 2 version

| | Breeze 2 (`northwind-angular22`) | Breeze 3 (`northwind-angular22-v3`) |
|---|---|---|
| npm packages | `breeze-client` 2.x + `breeze-entity-generator` | `breeze-client` 3.x only |
| Module format | ESM + CommonJS/UMD builds | ESM only |
| Entity generation | hand-written `generate-entities.js` | `breeze-gen-entities` command (an npm script) |
| Entity base class | hand-written `src/app/base-entity.ts` | `EntityBase` from `breeze-client` |
| Generated properties | `!` / `?` annotations | `declare` |
| Collection navigation type | `T[]` | `RelationArray<T>` |
| Custom code in entity classes | between `<code>` tags | anywhere; `// @manual` markers to protect a property |
| Metadata in the app | generated `model/metadata.ts` | `model/metadata.json`, imported directly |
| Class registration | `NorthwindRegistrationHelper.register()` | `registerModelClasses()` from `model/index.ts` |
| Breeze configuration | register four adapters + `NamingConvention.camelCase.setAsDefault()` | `configureBreeze({ fetch: httpClientFetch(http) })` |
| Angular HTTP integration | `breeze-client/adapter-ajax-httpclient` | `breeze-client/adapter-angular-httpclient` |
| Default naming convention | `none` | `camelCase` |

The Angular parts that both apps share - routing, environments, the customer component, and the query/save
calls - are unchanged.  Everything from the Optimus UI section on is new in this version and has nothing to do
with the Breeze upgrade: the Optimus UI interface, the orders panel, the order page and the unsaved-changes
guard.  The Breeze 2 app still has the plain HTML customer page only.  For every change between Breeze 2 and
Breeze 3, see the
[upgrade guide](https://github.com/Breeze/breeze-client-v3/blob/main/UPGRADE.md).

## Conclusion

We have come to the end of our journey.

We've created an Angular + Breeze application from the ground up,
using tools to create a simple entity model from the database for both the client and server parts of the application.

We now have an application that can create, read, update, and delete data, with a UI built from Optimus UI
components.  It loads related entities both on demand and all at once with `expand`, moves between pages with the
router, and won't let the user lose unsaved changes by accident.  It's ready to be extended to cover more entity
types and more complex use cases.
<hr>
If you have problems with this demo, please create issues in this github repo.

If you have questions about Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).
