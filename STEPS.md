# Steps for creating a Breeze application

A Breeze application has both client and server components.  In this walkthrough,
we'll start with creating a server with an entity model, and generating _metadata_ 
about the entity model.  Then we'll create a client, use that metadata to 
share the entity model between client and server, and use Breeze to query, track,
and update the entities.

We start with an empty directory, and create an end-to-end application that
queries and updates data.  Along the way we will:

- Create a new database schema
- Create a Breeze server using a popular technology stack
- Create an entity model from the database
- Create an API for interacting with the entity model
- Create metadata from the entity model
- Create a web application using a CLI
- Create TypeScript entity classes from the metadata
- Create a component to read and update entities

This is an opinionated approach -- the "productivity path" -- that 
[IdeaBlade](https://www.ideablade.com/) has found works well for many projects.  It includes generating entity classes for both server and client side, so that client and server have a shared understanding of the entity model.

The overall steps for creating our application:

1. Create the directory structure
2. Create the database (MS SQL Server or MySQL or Postgres or SQLite; see [dbscripts/README](./dbscripts/README.md))
3. Create the server ([.NET 5](server/STEPS-Server-NET5.md) or [.NET Core 3](server/STEPS-Server-Core3.md) or [2](server/STEPS-Server-Core2.md) or [NodeJS](server/STEPS-Server-Node.md))
4. Create the client ([Angular](client/STEPS-Client-Angular.md), [Aurelia](client/STEPS-Client-Aurelia.md), [React](client/STEPS-Client-React.md), or [Vue](client/STEPS-Client-Vue.md))

Let's get started!

## Create the directory

Our sample is going to have separate directories for client projects, server projects, and database scripts.  

We'll create subdirectories as we go, but start by creating the **client** and **server** root directories.

## Create the database

It's common to build a new app using an existing database, so we will start by
creating the sample database.  The sample database we will use is a subset of the 
classic Microsoft sample db, "Northwind".  

There are scripts to create an instance of the Northwind db for MS SQL Server, MySQL, Postgres, and SQLite.

See the [README](./dbscripts/README.md) in the [dbscripts](./dbscripts) directory and follow the instructions there to create your Northwind database.

Then come back here for the next steps.

## Next Steps

Next we'll work on the API server.  

See [STEPS-Server-NET5](server/STEPS-Server-NET5.md) for creating a .NET 5 server.

See [STEPS-Server-Core3](server/STEPS-Server-Core3.md) for creating a .NET Core 3 server.

See [STEPS-Server-Core2](server/STEPS-Server-Core2.md) for creating a .NET Core 2 server.

See [STEPS-Server-Node](server/STEPS-Server-Node.md) for creating a NodeJS server.

If you want to jump ahead to look at the client apps, see:

- [STEPS-Client-Angular](client/STEPS-Client-Angular.md) for an Angular app,
- [STEPS-Client-Aurelia](client/STEPS-Client-Aurelia.md) for an Aurelia app,
- [STEPS-Client-React](client/STEPS-Client-React.md) for a React app,
- [STEPS-Client-Vue](client/STEPS-Client-Vue.md) for a Vue app

<hr>

If you have problems with this demo, please create issues in this github repo.

If you have questions about Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).
