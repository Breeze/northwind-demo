# Northwind Demo

Breeze end-to-end demo with client and server, and [instructions](STEPS.md) on how to build it from scratch.

**Client** is one of 
  - Angular
  - React
  - Vue

**Server** is one of
  - .NET 5 with EFCore 5
  - .NET Core 3.1 with EFCore 3
  - .NET Core 2.2 with EFCore 2
  - NodeJS with Sequelize
  
**Northwind** is the name of a fictional food merchant.  The Northwind [database](./dbscripts/README.md) is a simple relational model suitable for a demo.

## Breeze Client and Server

**Breeze Client** ([breeze-client](https://www.npmjs.com/package/breeze-client)) is a JavaScript library for managing data on the client, much as an ORM manages it on the server.  

```
+------------ Browser --------------+
|    Angular / Vue / React / etc.   |
|-----------------------------------|
|          Breeze Client            |
+-----------------------------------|
                 |
                JSON
                 |
+---- Server (Node / .NET / Java) ----+
|           Web API Layer           |
|-----------------------------------|
|       Breeze Server library       |
|-----------------------------------|
|               ORM                 |
+-----------------------------------+
```

**Breeze Server** is a library that works with an ORM (Entity Framework, Sequelize, Hibernate) to manage persistence for Breeze client applications.  It turns Breeze queries into ORM queries, and saves changes to the database via the ORM.  

The power of Breeze comes from **shared metadata**, so that client and server have a shared understanding of the entity model.

## Get Started

See the [client](client) and [server](server) directories for the complete sample projects.  Any of the clients can work with any of the servers.

See the [STEPS](STEPS.md) document for the steps to create the sample from scratch.

<hr>

If you have problems with this demo, please create issues in this github repo.

If you have questions about Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).
