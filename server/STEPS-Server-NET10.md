# Steps for creating .NET 10 Breeze Server

Here are some steps to follow to create a new .NET 10 + EntityFramework Core 10 backend, using Breeze to handle the data management.

Later, we'll work on a client that talks to our server.

We will assume that you've already created the database and the **server** directory,
following the steps in the [STEPS](../STEPS.md) document.

For the server, we'll start with an empty directory, and implement a Breeze API that
our client can use to query and update data in the database.  Along the way we will:

- Create a .NET 10 solution
- Create C# entity classes from the database using EF
- Create an API for interacting with the entity model
- Create metadata from the entity model

You will need the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0).  The steps
below show the `dotnet` CLI commands, with the Visual Studio equivalents noted alongside;
use whichever you prefer.

## Create the .NET solution

Here we create the solution and the backend projects.  For this demo, we will have two projects: the model project, which implements the data model, and the server project, which implements the API.

From inside the **server** directory that you created earlier:

```
mkdir NorthwindNet10
cd NorthwindNet10
dotnet new sln -n NorthwindNet10
dotnet new web -n NorthwindServer -f net10.0
dotnet new classlib -n NorthwindModel -f net10.0
dotnet sln add NorthwindServer/NorthwindServer.csproj NorthwindModel/NorthwindModel.csproj
```

The `classlib` template creates a placeholder `Class1.cs` in **NorthwindModel**; delete it, we won't need it.

> In Visual Studio, this is File / New / Project... / **ASP.NET Core Empty** named **NorthwindServer**,
> with the solution named **NorthwindNet10** in the **server** directory ("Place solution and project in
> the same directory" NOT checked), targeting **.NET 10.0** and with "Configure for HTTPS" unchecked.
> Then add a **Class Library** project named **NorthwindModel** targeting **.NET 10.0**.

Now add a reference from the server project to the model project:

```
dotnet add NorthwindServer/NorthwindServer.csproj reference NorthwindModel/NorthwindModel.csproj
```

> In Visual Studio: right-click **NorthwindServer** / Add / Project Reference... and check **NorthwindModel**.
> Make sure **NorthwindServer** is the startup project.

## Add the Nuget packages

Add packages to the server project.  These support the data API that we will create using Breeze:

```
dotnet add NorthwindServer package Breeze.AspNetCore.NetCore
dotnet add NorthwindServer package Breeze.Persistence.EFCore
dotnet add NorthwindServer package Microsoft.AspNetCore.Mvc.NewtonsoftJson
dotnet add NorthwindServer package Microsoft.EntityFrameworkCore.Tools
```

Add a package to the model project.  This supports using Entity Framework for data access and data model creation:

```
dotnet add NorthwindModel package Microsoft.EntityFrameworkCore.SqlServer
```

> In Visual Studio, use Tools / Nuget Package Manager / Package Manager Console, set the Default project,
> and use `Install-Package <name>` for each of the packages above.

Breeze 7.5.1 is the version used here; it publishes a `net10.0` target, so no version pinning is needed.
Make sure the Microsoft packages resolve to **10.x** versions to match the target framework.  The
resulting `NorthwindServer.csproj` should look like this:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Breeze.AspNetCore.NetCore" Version="7.5.1" />
    <PackageReference Include="Breeze.Persistence.EFCore" Version="7.5.1" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.NewtonsoftJson" Version="10.0.10" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="10.0.10">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\NorthwindModel\NorthwindModel.csproj" />
  </ItemGroup>

</Project>
```

## Create the data model

We will create the data model classes from the database schema.  For this, we need a connection string for connecting to the database.  The commands below assume a local SQL Server instance; if you are using a separate server, you will need to change the Data Source and the security information in the connection string.

> If you haven't created the database yet, go back to the [STEPS](../STEPS.md) document and see the **Create the database** section.

Note the `TrustServerCertificate=True` in the connection string.  `Microsoft.Data.SqlClient` (used by
EF Core 10) defaults to `Encrypt=true`, so connecting to a local SQL Server with a self-signed
certificate fails without it.

If you are using the CLI, first make sure the `dotnet-ef` tool is installed and matches EF Core 10:

```
dotnet tool install --global dotnet-ef --version 10.0.10
```
(use `dotnet tool update` instead of `install` if you already have an older `dotnet-ef`)

Then, from the `NorthwindNet10` directory, scaffold the model:

```
dotnet ef dbcontext scaffold "Data Source=.;Initial Catalog=Northwind;Integrated Security=True;MultipleActiveResultSets=True;TrustServerCertificate=True" Microsoft.EntityFrameworkCore.SqlServer --project NorthwindModel --startup-project NorthwindServer --output-dir Models --namespace NorthwindModel.Models --context-namespace NorthwindModel.Models --force --no-onconfiguring
```
(The command above should all be on one line)

> In Visual Studio, use Tools / Nuget Package Manager / Package Manager Console with the Default project
> set to **NorthwindModel**, and run:
>
> `Scaffold-DbContext "Data Source=.;Initial Catalog=Northwind;Integrated Security=True;MultipleActiveResultSets=True;TrustServerCertificate=True" Microsoft.EntityFrameworkCore.SqlServer -OutputDir Models -Force -NoOnConfiguring`

Now you should have a **Models** folder in the **NorthwindModel** project, which contains classes for each of the Northwind database tables, and a `NorthwindContext.cs` that contains the EF DbContext class for accessing the database.

If you change the database schema, you can re-run the scaffold command to re-build the model classes.

The `-NoOnConfiguring` / `--no-onconfiguring` flag keeps the connection string out of the generated
`NorthwindContext`.  The context is configured through dependency injection instead, which we'll set up
below.

Because the project templates enable nullable reference types, the scaffolder generates nullable
annotations (`string?` for nullable columns, `= null!;` for required ones) and relies on them instead of
emitting `.IsRequired()` calls.  This is the same model; it's just expressed through the type system.

## Create the Persistence Manager

The PersistenceManager is a Breeze class that wraps the DbContext to provide Breeze data management.  We will create it in the **NorthwindServer** project, in a file named `NorthwindPersistenceManager.cs`:

```csharp
using Breeze.Persistence.EFCore;
using NorthwindModel.Models;

namespace NorthwindServer
{
    public class NorthwindPersistenceManager : EFPersistenceManager<NorthwindContext>
    {
        public NorthwindPersistenceManager(NorthwindContext dbContext) : base(dbContext) { }
    }
}
```

## Add a Breeze controller

We will add a controller class that will be the interface between the client and server.  Create a file named `BreezeController.cs` in the **NorthwindServer** project.

The class needs these attributes so it can perform Breeze queries:

```csharp
  [Route("api/[controller]/[action]")]
  [BreezeQueryFilter]
  public class BreezeController : ControllerBase
```
Note that
 - The `Route` attribute specifies the `[action]` as part of the path.
 - We've added the `[BreezeQueryFilter]` attribute

### Add the Persistence Manager to the BreezeController

Add a `persistenceManager` field to the `BreezeController` class, and a constructor that takes a `NorthwindContext` and sets the field.  This will be called by dependency injection.
```csharp
  private NorthwindPersistenceManager persistenceManager;
  public BreezeController(NorthwindContext dbContext)
  {
      persistenceManager = new NorthwindPersistenceManager(dbContext);
  }
```

### Add query methods to the BreezeController

Add a HttpGet method returning `IQueryable<>` for each of the `Customer`, `Order`, `Product`, and `Supplier` types in the data model.  We won't do one for `OrderItem` because we will only query those with an `Order`.

### Add a SaveChanges method to the BreezeController

This HttpPost method will be called by the client to create/update/delete entities.

The complete controller:

```csharp
using Breeze.AspNetCore;
using Breeze.Persistence;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using NorthwindModel.Models;

namespace NorthwindServer
{
    [Route("api/[controller]/[action]")]
    [BreezeQueryFilter]
    public class BreezeController : ControllerBase
    {
        private NorthwindPersistenceManager persistenceManager;
        public BreezeController(NorthwindContext dbContext)
        {
            persistenceManager = new NorthwindPersistenceManager(dbContext);
        }

        [HttpGet]
        public IQueryable<Customer> Customers()
        {
            return persistenceManager.Context.Customers;
        }
        [HttpGet]
        public IQueryable<Order> Orders()
        {
            return persistenceManager.Context.Orders;
        }
        [HttpGet]
        public IQueryable<Product> Products()
        {
            return persistenceManager.Context.Products;
        }
        [HttpGet]
        public IQueryable<Supplier> Suppliers()
        {
            return persistenceManager.Context.Suppliers;
        }

        [HttpPost]
        public ActionResult<SaveResult> SaveChanges([FromBody] JObject saveBundle)
        {
            return persistenceManager.SaveChanges(saveBundle);
        }

    }
}
```

Note there are no `using System.Linq;` or `using System.Collections.Generic;` statements: the project
templates enable `ImplicitUsings`, so the common namespaces are already in scope.

## Compile Time!

Now make sure the solution compiles with `dotnet build`.  Don't run it yet, there are a few more things to add.

## Add connection string

Add the connection string to the `appsettings.json` file in the **NorthwindServer** project
```json
  "ConnectionStrings": {
    "Northwind": "Data Source=.;Initial Catalog=Northwind;Integrated Security=True;MultipleActiveResultSets=True;TrustServerCertificate=True"
  },
```

## Set the port number

Change the default port numbers to **4000** in all the `applicationUrl` settings inside `Properties/launchSettings.json`.
```json
    "applicationUrl": "http://localhost:4000",
```

The `web` template creates both an `http` and an `https` profile.  For simplicity you can delete the
`https` profile and rename the `http` profile to `NorthwindServer`.

## Configure the Program class

Unlike .NET 5, the .NET 10 web template has no `Startup.cs`.  Application configuration and the HTTP
pipeline both live in `Program.cs`, using top-level statements and the `WebApplication` builder.

In the services section, we need to
1. Enable controllers, so our `BreezeController` class can be used to handle requests
2. Set JSON serialization options so the client-side Breeze can send and receive entities
3. Add an exception filter, so errors are communicated to the Breeze client
4. Add CORS services
5. Add the DbContext to dependency injection, so our BreezeController can receive it

Then, in the pipeline section, we add CORS and map the controllers.  Note that the order of the
statements is important.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddNewtonsoftJson(opt =>
    {
        // Set Breeze defaults for entity serialization
        var ss = JsonSerializationFns.UpdateWithDefaults(opt.SerializerSettings);
        if (ss.ContractResolver is DefaultContractResolver resolver)
        {
            resolver.NamingStrategy = null;  // remove json camelCasing; names are converted on the client.
        }
        ss.Formatting = Newtonsoft.Json.Formatting.Indented; // format JSON for debugging
    })
    // Add Breeze exception filter to send errors back to the client
    .AddMvcOptions(o => { o.Filters.Add(new GlobalExceptionFilter()); });

builder.Services.AddCors();

// Add DbContext using connection string
var connectionString = builder.Configuration.GetConnectionString("Northwind");
builder.Services.AddDbContext<NorthwindContext>(options => options.UseSqlServer(connectionString));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseRouting();

// Allow any host - development only!
app.UseCors(policy => policy
    .AllowAnyHeader()
    .AllowAnyMethod()
    .SetIsOriginAllowed((host) => true)
    .AllowCredentials()
);

app.MapControllers();
app.MapGet("/", () => "Hello World!");

app.Run();
```

The `using` statements go at the very top of the file, above the top-level statements:

```csharp
using Breeze.AspNetCore;
using Breeze.Core;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Serialization;
using NorthwindModel.Models;
using NorthwindServer;
```

## Configure the Program class to generate metadata

To make client-side development easier, we are going to generate Breeze _metadata_ from our entity model.  This metadata represents the structure of our entities, and will be shared between the server and the client.
Later we will use the metadata to generate TypeScript classes representing our entity types.

We want the application to produce metadata output, instead of starting the server, when we give it a
"metadata" command-line parameter.  Add this **before** the `WebApplication.CreateBuilder` line, so it
runs first:

```csharp
if (args.Length > 0 && args[0].Contains("metadata"))
{
    // Generate metadata and exit
    WriteMetadata();
    return;
}
```

Because we scaffolded the DbContext without an `OnConfiguring` method, it has no parameterless
constructor, so we build its options ourselves.  Add this helper at the bottom of `Program.cs`, after the
`app.Run()` statement:

```csharp
// Writes the Breeze metadata for the entity model to stdout.
// The DbContext is configured directly here because the scaffolded context
// has no OnConfiguring method (see the -NoOnConfiguring scaffolding flag).
static void WriteMetadata()
{
    var configuration = new ConfigurationBuilder()
        .SetBasePath(AppContext.BaseDirectory)
        .AddJsonFile("appsettings.json", optional: true)
        .Build();

    var options = new DbContextOptionsBuilder<NorthwindContext>()
        .UseSqlServer(configuration.GetConnectionString("Northwind"))
        .Options;

    using var dbContext = new NorthwindContext(options);
    var persistenceManager = new NorthwindPersistenceManager(dbContext);
    var metadata = persistenceManager.Metadata();
    Console.Out.WriteLine(metadata);
}
```

## Generate the metadata

Compile the solution, then open a command prompt in the `NorthwindNet10` directory.  Then run:

`dotnet NorthwindServer\bin\Debug\net10.0\NorthwindServer.dll metadata > ..\metadata.json`

_NOTE: Switch separators to `/` for OSX or Linux._

That will create a `metadata.json` file in the parent `server` directory.  The file
contains a big blob of JSON that represents the type information that EF knows about our data model.:
```json
{"structuralTypes":[{"shortName":"Customer","namespace":"NorthwindModel.Models","autoGeneratedKeyType":"Identity","defaultResourceName":"Customers",...
```

We'll use the `metadata.json` file later when we create the web client.

> The metadata produced here is the same as the metadata produced by the .NET 5 and .NET Core 3 servers,
> so the same client applications work against any of them without changes.

## Testing the server

Compile and run the solution.  It should open a browser and attempt to open a page on http://localhost:4000 ,
which should return "Hello World" due to `app.MapGet` in `Program.cs`.

Now let's test a Breeze query.  Change the URL to http://localhost:4000/api/breeze/customers

Now you should get a JSON result containing all the rows from the Customer table in the Northwind database:
```json
[
  {
    "$id": "1",
    "$type": "NorthwindModel.Models.Customer, NorthwindModel",
    "Id": 1,
    "FirstName": "Maria",
    "LastName": "Anders",
    "City": "Berlin",
    "Country": "Germany",
    "Phone": "030-0074321",
    "Orders": []
  },
  {
    "$id": "2",
    "$type": "NorthwindModel.Models.Customer, NorthwindModel",
    "Id": 2,
    "FirstName": "Ana",
    "LastName": "Trujillo",
    "City": "México D.F.",
    "Country": "Mexico",
    "Phone": "(5) 555-4729",
    "Orders": []
  }...
]
```
> If you don't get the result above, review the previous steps and try to see where you may have gone wrong.

Note that each Customer entity has an `$id` and `$type` property.

- The `$id` is for resolving circular references - each entity appear only once in the JSON tree, and if the entity is referenced again in the tree, it will be replaced by a `$ref` that references the `$id`.

- The `$type` identifies the entity type.  The Breeze client will use this to determine what type of entity to create on the client as a result of the query.

If you don't see the `$id` and `$type`, go back to the `Program.cs` file and make sure the JSON
serialization settings are correct.

To confirm that the `[BreezeQueryFilter]` is working, try a Breeze query.  The Breeze client sends the
query as a JSON object in the query string, so you can test one directly in the browser:

http://localhost:4000/api/breeze/orders?{"where":{"CustomerId":85},"take":1,"expand":["OrderItems"],"inlineCount":true}

That should return a `QueryResult` wrapper containing a single `Order` with its `OrderItems` populated.

# Create the client

If everything looks good on the server, we are ready to work on the client application.

Go to the [README](../client/README.md) in the [client](../client) directory to start your client app.
