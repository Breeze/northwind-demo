# Northwind Demo

Breeze end-to-end demo with client and server, and [instructions](STEPS.md) on how to build it from scratch.

**Client** is one of 
  - Angular
  - React
  - Vue

**Server** is one of
  - .NET Core 2.2 with EFCore 2
  - .NET Core 3.1 with EFCore 3
  - NodeJS with Sequelize
  
**Northwind** is the name of a fictious food merchant.  The Northwind [database](./dbscripts/README.md) is a simple relational model suitable for a demo.

## Breeze Client and Server

**Breeze Client** ([breeze-client](https://www.npmjs.com/package/breeze-client)) is a JavaScript library for managing data on the client, much as an ORM manages it on the server.  

<style scoped>
.diagram {
	text-align: center;
	display: flex;
	flex-direction: column;
}
.diagram .diagram-box {
	border: 2px solid gray; border-radius: 10px;
	flex: 1;
	margin: auto;
}
.diagram .diagram-box .diagram-box-title {
	font-size: smaller;
}
.diagram .diagram-box .diagram-box-row {
	margin: 0px 10px;
	padding: 8px;
	border-top: black solid 1px;
}
.diagram .diagram-line {
	width: 50%;
	padding: 10px 3px;
	border-right: black solid 3px;
	text-align: right;
}
</style>

<div class="diagram" style="width: 400px">
<div class="diagram-box" style="width: 300px">
	<div class="diagram-box-title">Browser</div>
	<div class="diagram-box-row" style="background-color: rgb(226, 98, 189);">Angular / Vue / React / etc.</div>
	<div class="diagram-box-row" style="background-color: rgb(126, 197, 238);"><b>Breeze JS</b></div>
</div>

<div class="diagram-line" style="line-height: 40px;">JSON</div>

<div class="diagram-box" style="width: 300px">
	<div class="diagram-box-title">Server (Node, .NET, Java)</div>
	<div class="diagram-box-row" style="background-color: rgb(113, 159, 192);">Web API layer</div>
	<div class="diagram-box-row" style="background-color: rgb(126, 197, 238);"><b>Breeze Server library</b></div>
	<div class="diagram-box-row" style="background-color: rgb(219, 212, 184);">ORM</div>
</div>
</div>

**Breeze Server** is a library that works with an ORM (Entity Framework, Sequelize, Hibernate) to manage persistence for Breeze client applications.  It turns Breeze queries into ORM queries, and saves changes to the database via the ORM.  

The power of Breeze comes from **shared metadata**, so that client and server have a shared understanding of the entity model.

## Get Started

See the [client](client) and [server](server) directories for the complete sample projects.  Any of the clients can work with any of the servers.

See the [STEPS](STEPS.md) document for the steps to create the sample from scratch.

<hr>

If you have problems with this demo, please create issues in this github repo.

If you have questions about Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).
