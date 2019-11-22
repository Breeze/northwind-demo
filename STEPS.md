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
3. Create the server ([.NET Core](./STEPS-Server-Core.md) or NodeJS)
4. Create the client ([Angular](./STEPS-Client-Angular), React, or Vue)

Let's get started!

## Create the directory

Our sample is going to have separate directories for client projects, server projects, and database scripts.  

We'll create subdirectories as we go, but start by creating the root directory.  We'll call it **NorthwindCore**.

## Create the database

It's common to build a new app using an existing database, so we will start by
creating the sample database.  The sample database we will use is a subset of the 
classic Microsoft sample db, "Northwind".  The scripts for creating it were copied
from the SQL tutorial site [dofactory](https://www.dofactory.com/sql/sample-database).

The scripts assume MS SQL Server or SQL Express.  If you are using a different database server, you will need to adapt the scripts accordingly.

1. Copy contents of the `dbscripts` folder from the sample repo into your own `dbscripts` folder.

2. In SQL Server Management Studio (or similar tool), create the database:

        CREATE DATABASE NorthwindCore
        GO
        USE NorthwindCore
        GO

3. Open and run the script to create the tables, `dbscripts\sample-model.sql`

4. Open and run the script to insert the data, `dbscripts\sample-data.sql`

## Next Steps

Next we'll work on the API server.  

See [STEPS-Server-Core](./STEPS-Server-Core.md) for creating a .NET Core server.

<!-- See [STEPS-Server-Node](./STEPS-Server-Node.md) for creating a NodeJS server. -->
