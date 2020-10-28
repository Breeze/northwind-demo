# Steps for creating a Node.js Breeze Server

In just a few steps, we will create a Breeze server on Node.js.   The server will implement an API
that will allow us to read and update a relational database.  We'll use `Express`, `Sequelize`, and `Breeze-Sequelize`.  

We will write it in TypeScript because it helps make more maintainable apps.

Later, we'll work on a client that talks to our server.

We will assume that you've already created the database and the **NorthwindCore** directory,
following the steps in the [STEPS](./STEPS.md) document.

For the server, we'll start with an empty directory, and implement a Breeze API that
our client can use to query and update data in the database.  Along the way we will:

- Create an Express web server
- Export entity classes from the database using `sequelize-auto`
- Create metadata from the entity model
- Create an API for interacting with the entity model

## Prerequisites

First, make sure you have [nodejs](https://nodejs.org) and [npm](https://docs.npmjs.com/) installed.

Next, create a directory to hold our server.  Create it under **NorthwindCore**, and call it **NorthwindSequelize**.

## Install the packages 

Open a command prompt in the **NorthwindSequelize** directory.

1. `npm init` to create the `package.json` file
2. `npm install --save sequelize sequelize-auto breeze-client breeze-sequelize`
3. `npm install --save express cors body-parser typescript`

You'll also need to install a package that is specific to the database dialect you are using:

Dialect | Install
---|---
MySQL/MariaDB | `npm install mysql2`
Postgres | `npm install pg pg-hstore`
Sqlite | `npm install sqlite3`
MSSQL | `npm install tedious`

If you haven't installed the database yet, go back to the [STEPS](./STEPS.md) document.

If you don't have a database preference, we recommend **SQLite** for this project because it requires no installation except for the `sqlite3` package.

## Create a config file 

Now we will write some code.  First we will create a config file to hold our project settings.

These settings will be used by both our _export_ script, and by our _server_, so we will put them in a shared file.

In the **NorthwindSequelize** directory, create file `config.ts`.  In the file put the following:

```js
import { DbConfig } from "breeze-sequelize/types/dbUtils";
import { join } from "path";
import { AutoOptions } from "sequelize-auto";

const storage = join(__dirname, "../northwind.sqlite");  // db file created earlier
const models = join(__dirname, "./models");  // subdirectory to store model files

export const config: DbConfig = {
  dbName: 'northwind',  // name of database created earlier
  user: '',             // user empty for sqlite
  password: '',         // password empty for sqlite
};

export const options: AutoOptions = {
  dialect: 'sqlite',  // sqlite | mysql | mssql | postgres
  storage: storage,   // storage is for sqlite only
  directory: models   // where to write the models
};

export const namespace = "NorthwindModel.Models";  // namespace for entity names
```

## Create the export script 

The export script does two things:
1. Creates the model classes that Sequelize uses to read and update the database tables
2. Creates the `metadata.json` file that Breeze uses to share models between client and server

It uses the `config.ts` file that we created in the previous step, as well as `sequelize-auto` and `breeze-sequelize`

In the **NorthwindSequelize** directory, create file `export.ts`.  In the file put the following:

```js
import { SequelizeManager } from "breeze-sequelize";
import { writeFileSync } from "fs";
import { SequelizeAuto } from "sequelize-auto";
import { config, namespace, options } from "./config";

const auto = new SequelizeAuto(config.dbName, config.user, config.password, options);

// export the table model to the "models" directory
auto.run().then(data => {
  console.log(Object.keys(data.tables));  // list the exported tables

  // import models into Breeze, and export the resulting metadata
  const sequelizeManager = new SequelizeManager(config, options);
  sequelizeManager.importModels(options.directory, namespace);

  const metadata = sequelizeManager.metadataStore.exportMetadata();
  writeFileSync("metadata.json", metadata);
});
```

## Export the model and metadata

Open a command prompt in the **NorthwindSequelize** directory.  Compile the TypeScript that you wrote above:

```
> tsc
```
and run the export script:
```
> node export
```
This should create a **models** subdirectory, with a file for each of the database tables:
```
Customer.js
Order.js
OrderItem.js
Product.js
Supplier.js
init-models.js
```
These files describe the entity model that Sequelize will use when reading and writing data.
The `init-models.js` file contains the initializer code that will load all the models into Sequelize.

The export script also creates a `metadata.json` file in the current **NorthwindSequelize** directory.
This file is used to communicate the model structure to the client.  We will use it later, when we
work on the client.

## Create the server: middleware functions

Now we will start working on the server.  We will start by creating the "middleware" functions, then create the Express server that uses them.

In Express, "middleware" functions are used to handle requests.  Many such functions can be registered, and Express will choose the correct ones to call
based on the request method and the _route_, or path, of the request URL.  

In our Breeze API server, we need to handle GET requests when we query for data, 
and POST requests when we create, update, or delete data.

### Breeze GET requests

In a Breeze _query_ request, the URL path contains the resource name (entity type), and the query string contains the filtering parameters.  
Here is an example, querying Customers in Germany:
```
GET /api/breeze/Customer?{"where":{"Country":"Germany"}}
```
Our middleware will handle this in a `query` function that converts the request to a `SequelizeQuery`, executes it, and returns the results.

Our middleware will handle this request by:
1. Extracting the resource name ("Customer" in this example)
2. Converting the URL to a Breeze `EntityQuery`
3. Converting the `EntityQuery` to a `SequelizeQuery`
4. Executing the `SequelizeQuery`
5. Sending the results to the client.

### Breeze POST requests

In a Breeze _save_ request, the URL goes to the SaveChanges endpoint, and the payload contains the entities to be saved.  Here is an example, saving a single customer:
```
POST /api/breeze/SaveChanges
{
  "entities": [
    {
      "Id": 69,
      "City": "Madrid",
      "Country": "Spain",
      ...
      "entityAspect": {
        "entityTypeName": "Customer:#NorthwindModel.Models",
        "entityState": "Modified",
        ...
      }
    }
  ]
}
```
Our middleware will handle this in a `saveChanges` function that uses a `SequelizeSaveHandler` to convert the request to Sequelize commands.  
It returns the saved entities in the result.

Our middleware will handle two routes: 
- `/api/breeze/SaveChanges` for saves, and 
- `/api/breeze/{slug}` for queries, where {slug} is the resource name.

## Create routes.ts

In the **NorthwindSequelize** directory, create file `routes.ts`.  In the file put the following:

```js
import {
  SequelizeManager, SequelizeQuery, SequelizeQueryResult, SequelizeSaveHandler, SequelizeSaveResult,
  urlToEntityQuery
} from "breeze-sequelize";
import { NextFunction, Request, Response } from "express";
import { config, namespace, options } from "./config";

const sequelizeManager = createSequelizeManager();

function createSequelizeManager() {
  (options as any).logging = console.log;  // log to console
  const sm = new SequelizeManager(config, options);
  sm.importModels(options.directory, namespace);
  return sm;
}

/** Handle GET: /api/breeze/Customer?{"where":{"Country":"Germany"}} */
export function query(req: Request, res: Response, next: NextFunction) {
  const resourceName = req.params.slug;  // e.g. Customer
  const entityQuery = urlToEntityQuery(req.url, resourceName);

  const sequelizeQuery = new SequelizeQuery(sequelizeManager, entityQuery);
  sequelizeQuery.execute().then(r => {
    returnResults(r, res);
  }).catch(e => {
    next(e);
  });
}

/** Handle POST: /api/breeze/SaveChanges */
export function saveChanges(req: Request, res: Response, next: NextFunction) {
  const saveHandler = new SequelizeSaveHandler(sequelizeManager, req);
  saveHandler.save().then(r => {
    returnResults(r, res);
  }).catch(e => {
    next(e);
  });
}

/** Send JSON result to client */
function returnResults(results: SequelizeQueryResult | SequelizeSaveResult, res: Response) {
  res.setHeader("Content-Type", "application/json");
  res.send(results);
}
```

## Create the server: Express configuration

Now we'll create the script to configure Express using the middleware we created above.

In the **NorthwindSequelize** directory, create file `server.ts`.  In the file put the following:

```js
import e from "express";
import { Request, Response, NextFunction } from "express";
import * as  bodyParser from "body-parser";
import * as routes from "./routes";
const cors = require("cors");

const app: e.Application = e();

// Configure CORS and request parsing
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({limit: "50mb"}));

// Set up handler for Breeze save and query
app.post("/api/breeze/SaveChanges", routes.saveChanges);
app.get("/api/breeze/:slug", noCache, routes.query);

app.use(errorHandler);
app.listen(4000);
console.log("Listening on port 4000");

/** Tell browser not to cache query results */
function noCache(req: Request, res: Response, next: NextFunction): void {
  res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.header("Expires", "-1");
  res.header("Pragma", "no-cache");
  next();
}

/** Log error and return message to client */
function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error(err.stack);
  const status: number = err.statusCode || 500;
  if (err.message) {
    res.status(status).send(err.message);
  } else {
    res.status(status);
  }
}
```
