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
2. Create the database
3. Create the server ([.NET Core 2](./STEPS-Server-Core.md) or [.NET Core 3](./STEPS-Server-Core3.md) or NodeJS)
4. Create the client ([Angular](./STEPS-Client-Angular.md), [React](./STEPS-Client-React.md), or [Vue](./STEPS-Client-Vue.md))

Let's get started!

## Create the directory

Our sample is going to have separate directories for client projects, server projects, and database scripts.  

We'll create subdirectories as we go, but start by creating the root directory.  We'll call it **NorthwindCore**.

## Create the database

It's common to build a new app using an existing database, so we will start by
creating the sample database.  The sample database we will use is a subset of the 
classic Microsoft sample db, "Northwind".  

See the README in the [dbscripts](./NorthwindCore/dbscripts) directory and follow the instructions there to create your Northwind database.

Then come back here for the next steps.

## Next Steps

Next we'll work on the API server.  

See [STEPS-Server-Core](./STEPS-Server-Core.md) for creating a .NET Core 2 server.

See [STEPS-Server-Core3](./STEPS-Server-Core3.md) for creating a .NET Core 3 server.

See [STEPS-Server-Node](./STEPS-Server-Node.md) for creating a NodeJS server.

If you want to jump ahead to look at the client apps, see:

- [STEPS-Client-Angular](./STEPS-Client-Angular.md) for an Angular app,
- [STEPS-Client-React](./STEPS-Client-React.md) for a React app,
- [STEPS-Client-Vue](./STEPS-Client-Vue.md) for a Vue app