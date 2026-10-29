# Adding an MCP Server to the .NET 10 Breeze Server

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open standard that lets AI assistants,
such as Claude, use tools and read data provided by other applications.  Here we'll add an MCP server to the
.NET 10 Northwind server, so that an assistant can answer questions about the Northwind data - "who are our top 5
customers in Germany by total spent?" - by querying it directly.

We will assume that you've already created the .NET 10 server by following
[STEPS-Server-NET10](STEPS-Server-NET10.md).  The MCP server runs inside that same server, next to the Breeze
controller, and uses the same `NorthwindContext`.  Along the way we will:

- Add the official C# MCP SDK to the server
- Create a general-purpose `query` tool that runs Breeze JSON queries, the same queries the Breeze client sends
- Create a few tools for the questions people ask most often
- Offer the Breeze metadata as an MCP resource
- Keep the endpoint local and read-only
- Connect Claude Code to it
- Test it, including a test that each tool's result matches its declared shape

The finished code is in [NorthwindNet10](NorthwindNet10): the MCP code is in `NorthwindServer/Mcp`, and the
tests are in `NorthwindServer.Tests`.

## What we're building

MCP servers offer **tools**, which an assistant can call with arguments, and **resources**, which it can read.
Ours will offer these, all read-only:

| Tool | What it's for |
|---|---|
| `describe_model` | Lists the entity sets with their properties and navigation properties, from the EF model |
| `query` | Runs a Breeze JSON query (`where`, `orderBy`, `select`, `expand`, `skip`, `take`) against any entity set, and returns a page of results with the total count |
| `search_customers` | Finds customers by name, city or country |
| `get_customer` | Gets a customer with their orders and the total they've spent |
| `get_order` | Gets an order, by id or order number, with its customer and its items, including products and suppliers |
| `top_products` | Ranks products by revenue or units sold, optionally between two dates |

| Resource | What it's for |
|---|---|
| `breeze://metadata` | The Breeze metadata, the same that the Breeze client uses |

The tools come in two kinds:

- **`describe_model` and `query` are general-purpose.**  They work from the EF model and Breeze's own query
  engine, so they can answer almost any question that's a query, about any entity set, and nothing in them is
  specific to Northwind except the name of the `DbContext`.  The assistant reads the model, then writes queries,
  just as the Breeze client does.
- **The other four are written for particular questions.**  Each takes simple arguments and returns a result with
  a fixed shape, so they're easy for an assistant to use well.  They also cover what the `query` tool can't do:
  `query` can't group or add up values, so it can't total sales, while `get_customer` and `top_products` can.

The MCP endpoint is served over HTTP, at `http://localhost:4000/mcp`, using MCP's "Streamable HTTP" transport.

## Add the MCP package

The official C# SDK for MCP is published as three NuGet packages.  For a server inside an ASP.NET Core app we
need `ModelContextProtocol.AspNetCore`, which brings in the other two.  From the `NorthwindNet10` directory:

```
dotnet add NorthwindServer package ModelContextProtocol.AspNetCore --version 2.3.0
```

> **Visual Studio:** right-click the `NorthwindServer` project, choose **Manage NuGet Packages**, and install
> `ModelContextProtocol.AspNetCore`.

The SDK's documentation is at [csharp.sdk.modelcontextprotocol.io](https://csharp.sdk.modelcontextprotocol.io).

## Create the result types

The four question-specific tools return their own result types, rather than the EF entities.  The entities'
navigation properties refer back to each other (a customer's orders each refer to the customer), so they don't
make a plain tree, and their shape depends on what was loaded.  Our own records have a fixed shape, which the SDK
describes to the assistant as an **output schema**, a JSON Schema for the result.

Create a folder `Mcp` in the `NorthwindServer` project, and in it create `NorthwindResults.cs`:
```csharp
using System.ComponentModel;

namespace NorthwindServer.Mcp;

// Results of the Northwind MCP tools.  The tools return these instead of the EF entities,
// whose navigation properties refer back to each other, so that each result is a plain tree
// with a fixed shape that can be described by an output schema.

public record CustomerSummary(
    int Id,
    string FirstName,
    string LastName,
    string? City,
    string? Country,
    string? Phone,
    [property: Description("Number of orders the customer has placed")] int OrderCount);

public record CustomerSearchResult(
    [property: Description("Total number of customers that match, across all pages")] int TotalCount,
    int Skip,
    int Take,
    IReadOnlyList<CustomerSummary> Customers);

public record OrderSummary(int Id, string? OrderNumber, DateOnly OrderDate, decimal? TotalAmount, int ItemCount);

public record CustomerDetails(
    CustomerSummary Customer,
    [property: Description("Sum of the total amounts of all of the customer's orders")] decimal TotalSpent,
    [property: Description("The customer's orders, most recent first")] IReadOnlyList<OrderSummary> Orders);

public record OrderItemDetails(
    int ProductId,
    string ProductName,
    string? Package,
    bool IsDiscontinued,
    string SupplierName,
    [property: Description("Price per unit on this order, which may differ from the product's current price")] decimal UnitPrice,
    int Quantity,
    decimal LineTotal);

public record OrderDetails(
    int Id,
    string? OrderNumber,
    DateOnly OrderDate,
    decimal? TotalAmount,
    CustomerSummary Customer,
    IReadOnlyList<OrderItemDetails> Items);

public record ProductSales(
    int ProductId,
    string ProductName,
    string SupplierName,
    bool IsDiscontinued,
    [property: Description("Sum of unit price times quantity over the matching order items")] decimal Revenue,
    [property: Description("Total units sold")] int Quantity,
    [property: Description("Number of distinct orders that included the product")] int OrderCount);

public record TopProductsResult(DateOnly? From, DateOnly? To, string RankedBy, IReadOnlyList<ProductSales> Products);

public record PropertyDescription(
    string Name,
    string Type,
    bool IsNullable,
    bool IsKey,
    [property: Description("Maximum length, for strings that have one")] int? MaxLength);

public record NavigationDescription(
    string Name,
    [property: Description("The entity type at the other end")] string Target,
    [property: Description("True if the navigation is a collection of related entities")] bool IsCollection,
    [property: Description("The foreign key property, on whichever side holds it")] string ForeignKey);

public record EntitySetDescription(
    [property: Description("Name to pass as entitySet to the query tool")] string EntitySet,
    string EntityType,
    IReadOnlyList<PropertyDescription> Properties,
    IReadOnlyList<NavigationDescription> Navigations);

public record ModelDescription(IReadOnlyList<EntitySetDescription> EntitySets);
```
The `[Description]` attributes become descriptions in the output schema, which helps the assistant understand
values whose meaning isn't obvious from the name.  `[property: ...]` puts the attribute on the record's
property, which is what the schema is built from, rather than on the constructor parameter.

Note that order dates are `DateOnly`, not `DateTime`.  The database stores them as `datetime` with no time zone,
and a `DateTime` with no time zone is written as `"2014-04-09T00:00:00"`.  The output schema describes a
`DateTime` as a standard date-time, which requires a time zone, so clients that check results against the schema
reject it.  Northwind's order dates have no meaningful time of day, so a plain date is both correct and valid.

## Create the general-purpose tools

Create `Mcp/BreezeQueryTools.cs`:
```csharp
using System.Collections;
using System.ComponentModel;
using System.Reflection;
using Breeze.Core;
using Microsoft.EntityFrameworkCore;
using ModelContextProtocol;
using ModelContextProtocol.Server;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NorthwindModel.Models;

namespace NorthwindServer.Mcp;

/// <summary>
/// General-purpose, read-only MCP tools for querying any entity set of the DbContext with a Breeze JSON query,
/// the same query language the Breeze client sends to the BreezeController.
/// Nothing here is specific to Northwind except the DbContext type.
/// </summary>
[McpServerToolType]
public class BreezeQueryTools
{
    public const int DefaultTake = 25;
    public const int MaxTake = 100;

    // The DbSet properties of the context, by name: "Customers", "Orders", ...
    private static readonly Dictionary<string, PropertyInfo> EntitySets = typeof(NorthwindContext).GetProperties()
        .Where(p => p.PropertyType.IsGenericType && p.PropertyType.GetGenericTypeDefinition() == typeof(DbSet<>))
        .ToDictionary(p => p.Name, StringComparer.OrdinalIgnoreCase);

    // Serialize entities as plain JSON: navigation properties that point back up the tree are left out,
    // rather than written as Breeze's $id/$ref references
    private static readonly JsonSerializer ResultSerializer = JsonSerializer.Create(new JsonSerializerSettings
    {
        ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
        NullValueHandling = NullValueHandling.Ignore,
    });

    // Related entities that weren't expanded come out as empty collections, and so do collections that only
    // point back up the tree.  Either way they would look like "none", so leave them out
    private static void RemoveEmptyCollections(JToken token)
    {
        foreach (var property in token.Children<JProperty>().ToList())
        {
            if (property.Value is JArray { Count: 0 })
            {
                property.Remove();
            }
        }
        foreach (var child in token.Children())
        {
            RemoveEmptyCollections(child);
        }
    }

    [McpServerTool(Name = "describe_model", Title = "Describe the data model", ReadOnly = true, Idempotent = true,
        UseStructuredContent = true)]
    [Description("Lists the entity sets that the query tool can query, with each entity type's properties and its "
        + "navigation properties to related entities.  Property names are as the query tool expects them.")]
    public static ModelDescription DescribeModel(NorthwindContext db)
    {
        var sets = EntitySets.Values.OrderBy(p => p.Name).Select(prop =>
        {
            var entityType = db.Model.FindEntityType(prop.PropertyType.GetGenericArguments()[0])!;
            var keys = entityType.FindPrimaryKey()?.Properties.Select(p => p.Name).ToHashSet() ?? [];
            var properties = entityType.GetProperties().Select(p => new PropertyDescription(
                p.Name, TypeName(p.ClrType), p.IsNullable, keys.Contains(p.Name), p.GetMaxLength())).ToList();
            var navigations = entityType.GetNavigations().Select(n => new NavigationDescription(
                n.Name, n.TargetEntityType.ClrType.Name, n.IsCollection,
                string.Join(", ", n.ForeignKey.Properties.Select(p => $"{p.DeclaringType.ClrType.Name}.{p.Name}")))).ToList();
            return new EntitySetDescription(prop.Name, entityType.ClrType.Name, properties, navigations);
        }).ToList();
        return new ModelDescription(sets);
    }

    [McpServerTool(Name = "query", Title = "Query an entity set", ReadOnly = true, Idempotent = true)]
    [Description("""
        Queries one entity set with a Breeze JSON query, and returns a page of matching entities as JSON, with the
        total number of matches.  Use describe_model first to see the entity sets and their property names.

        Property names are PascalCase, exactly as describe_model lists them, and can follow navigation
        properties with dots, e.g. "Customer.Country".  The query is a JSON object with any of these members:
          "where":   {"Country": "Germany"}                                      equality
                     {"TotalAmount": {"gt": 1000}}                               eq, ne, lt, le, gt, ge
                     {"LastName": {"startswith": "Ca"}}                          startswith, endswith, contains
                     {"Country": {"in": ["France", "Spain"]}}
                     {"OrderDate": {"ge": "2013-01-01"}}                         dates as ISO strings
                     {"and": [ ... ]}, {"or": [ ... ]}, {"not": { ... }}         combine conditions
                     {"OrderItems": {"any": {"Quantity": {"gt": 50}}}}           conditions on collections (any, all)
          "orderBy": ["LastName", "FirstName desc"]
          "select":  ["Id", "LastName", "Customer.Country"]                      return only these properties
                                                                                 (a path comes back as Customer_Country)
          "expand":  ["Customer", "OrderItems.Product"]                          include related entities
          "skip":    20
          "take":    10
        Related entities appear in the results only when you expand them; an expanded collection with no
        entries is left out.  Results are limited to 100 entities per call (25 if take is not given); use
        skip and take to page.  The query tool can't group or add up values; for sales totals use top_products.
        """)]
    public static string Query(
        NorthwindContext db,
        [Description("Name of the entity set, from describe_model, e.g. \"Customers\" or \"Orders\"")] string entitySet,
        [Description("Breeze JSON query; omit for the first page of the whole entity set")] string? query = null)
    {
        if (!EntitySets.TryGetValue(entitySet, out var setProperty))
        {
            throw new McpException($"There is no entity set named '{entitySet}'.  "
                + $"The entity sets are: {string.Join(", ", EntitySets.Keys.Order())}.");
        }
        var elementType = setProperty.PropertyType.GetGenericArguments()[0];

        EntityQuery entityQuery;
        int take;
        try
        {
            entityQuery = new EntityQuery(query);
            // Limit the page size.  Take returns a new query, so do it before validating
            take = Math.Clamp(entityQuery.TakeCount ?? DefaultTake, 0, MaxTake);
            if (entityQuery.TakeCount != take)
            {
                entityQuery = entityQuery.Take(take);
            }
            entityQuery.Validate(elementType);
        }
        catch (Exception e)
        {
            throw new McpException($"The query is not valid: {e.Message}");
        }

        // Read only: no change tracking, so there's nothing to save, and the context only holds what was asked for
        var queryable = AsNoTracking(elementType, (IQueryable)setProperty.GetValue(db)!);

        int totalCount;
        var results = new List<object?>();
        try
        {
            // Apply the clauses in the order Breeze requires, counting the matches before paging
            queryable = entityQuery.ApplyWhere(queryable, elementType);
            totalCount = Count(elementType, queryable);
            queryable = entityQuery.ApplyOrderBy(queryable, elementType);
            queryable = entityQuery.ApplySkip(queryable, elementType);
            queryable = entityQuery.ApplyTake(queryable, elementType);
            queryable = entityQuery.ApplySelect(queryable, elementType);
            // Breeze.Core's ApplyExpand finds Include dynamically, which can't see EF's Include extension method;
            // Breeze's EF Core package has one that calls it directly
            queryable = Breeze.Persistence.EFCore.EFExtensions.ApplyExpand(entityQuery, queryable, elementType);

            foreach (var item in (IEnumerable)queryable)
            {
                results.Add(item);
            }
        }
        catch (Exception e)
        {
            var reason = (e is TargetInvocationException { InnerException: { } inner } ? inner : e).Message;
            throw new McpException($"The query could not be run: {reason}");
        }

        var resultsJson = JArray.FromObject(results, ResultSerializer);
        RemoveEmptyCollections(resultsJson);
        var response = new JObject
        {
            ["EntitySet"] = setProperty.Name,
            ["TotalCount"] = totalCount,
            ["Skip"] = entityQuery.SkipCount ?? 0,
            ["Take"] = take,
            ["Returned"] = results.Count,
            ["Results"] = resultsJson,
        };
        return response.ToString(Formatting.Indented);
    }

    private static IQueryable AsNoTracking(Type elementType, IQueryable source) =>
        (IQueryable)AsNoTrackingMethod.MakeGenericMethod(elementType).Invoke(null, [source])!;

    private static int Count(Type elementType, IQueryable source) =>
        (int)CountMethod.MakeGenericMethod(elementType).Invoke(null, [source])!;

    private static readonly MethodInfo AsNoTrackingMethod =
        typeof(EntityFrameworkQueryableExtensions).GetMethod(nameof(EntityFrameworkQueryableExtensions.AsNoTracking))!;

    private static readonly MethodInfo CountMethod = typeof(Queryable).GetMethods()
        .Single(m => m.Name == nameof(Queryable.Count) && m.GetParameters().Length == 1);

    private static string TypeName(Type type)
    {
        var underlying = Nullable.GetUnderlyingType(type) ?? type;
        return underlying.Name switch
        {
            "Int32" => "int",
            "Int64" => "long",
            "String" => "string",
            "Boolean" => "bool",
            "Decimal" => "decimal",
            "Double" => "double",
            "DateTime" => "DateTime",
            _ => underlying.Name,
        };
    }
}
```
There's a lot here, so let's take it a piece at a time.

### Declaring tools

A class marked `[McpServerToolType]` holds tools, and each method marked `[McpServerTool]` is one tool:

 - `Name` is the tool's name, and `Title` a human-readable one
 - `ReadOnly = true` and `Idempotent = true` tell the client that the tool changes nothing, and that calling it
   twice gives the same answer.  Clients can use these hints, for example to run read-only tools without asking
 - `UseStructuredContent = true` makes the SDK return the result as structured JSON, and publish an output schema
   for it, built from the return type.  `query` doesn't use it, because its result has no fixed shape
 - The `[Description]` on the method tells the assistant what the tool is for and how to use it.  It's the main
   thing the assistant reads when it decides which tool to call, so it's worth writing carefully.  For `query`, the
   description is a short manual for Breeze's JSON query language, with an example of each kind of condition

The method's parameters become the tool's arguments, with JSON Schema types built from their .NET types, and their
`[Description]`s.  Parameters that aren't arguments are filled in by the SDK: here, `NorthwindContext db` comes
from the server's dependency injection, so each call gets a context just as a controller action would.

### The entity sets

`EntitySets` finds the `DbSet<>` properties of `NorthwindContext` by reflection, so both tools automatically cover
every entity set the context has: `Customers`, `OrderItems`, `Orders`, `Products` and `Suppliers`.

`describe_model` reads the EF model (`db.Model`) for each one: its properties, with type, nullability, key and
maximum length, and its navigation properties, with the foreign key that connects them.  That's a short summary of
what's in the Breeze metadata, in the form the `query` tool needs.  The names are the server's names, in
PascalCase, because the query tool runs on the server and doesn't apply the camelCase naming convention that the
Breeze client does.

### Running a Breeze query

This is where Breeze does the work.  Breeze.Core can run a query from the JSON a Breeze client sends, without a
controller:

1. `new EntityQuery(query)` parses the JSON
2. `entityQuery.Validate(elementType)` checks every property name and comparison against the entity type, and
   throws if one is wrong, which we turn into a message for the assistant
3. The `Apply...` methods add each clause to an `IQueryable`, **in the order Breeze requires**: where, then
   orderBy, skip and take, then select, and expand last

Between the `where` and the `orderBy`, we count the matching entities, so the result can say how many there are in
all, like the `inlineCount` the Angular client uses for paging.

A few details:

 - **Page size.**  An assistant can ask for a lot of data, and every entity it gets takes up room in its context.
   So we return 25 entities unless it asks for a different number, and never more than 100.  `Take` returns a new
   query, so we limit it before validating.
 - **No change tracking.**  `AsNoTracking` tells EF not to track the entities, since nothing will be saved, and
   keeps the context from linking them to anything that wasn't asked for.  `AsNoTracking` and `Count` are generic
   methods, and we only know the entity type at runtime, so they're called through reflection.
 - **Expand.**  Breeze.Core's `ApplyExpand` looks for an `Include` method dynamically, and dynamic calls can't find
   EF's `Include` extension method, so it fails with "does not contain a definition for 'Include'".  Breeze's EF
   Core package has an `ApplyExpand` that calls EF's `Include` directly, so we use that one.  (We have to give its
   full name, `Breeze.Persistence.EFCore.EFExtensions`, because EF also has a class called `EFExtensions`.)
 - **Errors.**  If a tool throws an `McpException`, the SDK sends its message to the assistant as the tool's
   error, so the assistant can correct itself: an unknown entity set lists the valid ones, and an unknown property
   is named.  Other exceptions only produce a generic "An error occurred", so we catch them and turn them into
   `McpException`s.

### The JSON for the results

The Breeze controller writes entities with `$id`/`$ref` references, which the Breeze client understands but which
are hard for an assistant to follow.  So the query tool writes plain JSON, using Newtonsoft.Json, as the
controller does, but with different settings:

 - `ReferenceLoopHandling.Ignore` leaves out a navigation property that points back up the tree - such as each
   order's `Customer`, inside a customer's `Orders`
 - `NullValueHandling.Ignore` leaves out navigation properties that weren't loaded, which are null
 - `RemoveEmptyCollections` removes empty arrays.  A collection navigation that wasn't expanded comes out as an
   empty array, and so does one whose entities were all left out as loops.  Either way it would look like "none" -
   a customer with `"Orders": []` looks like a customer who has never ordered - so we leave it out instead, and the
   tool's description says that related entities only appear when you expand them

## Create the question-specific tools

Create `Mcp/NorthwindTools.cs`:
```csharp
using System.ComponentModel;
using Microsoft.EntityFrameworkCore;
using ModelContextProtocol;
using ModelContextProtocol.Server;
using NorthwindModel.Models;

namespace NorthwindServer.Mcp;

/// <summary>
/// Read-only MCP tools for the questions people most often ask about the Northwind data.
/// Each returns a fixed-shape result, described to the client by an output schema.
/// </summary>
[McpServerToolType]
public class NorthwindTools
{
    public const int MaxTake = 100;

    [McpServerTool(Name = "search_customers", Title = "Search customers", ReadOnly = true, Idempotent = true,
        UseStructuredContent = true)]
    [Description("Finds customers by name, city or country.  Every word of the search text must appear in the "
        + "first name, last name, city or country, so \"maria berlin\" finds Maria Anders of Berlin.  "
        + "With no text, lists all customers.  Results are sorted by last name, then first name, a page at a time.")]
    public static async Task<CustomerSearchResult> SearchCustomers(
        NorthwindContext db,
        [Description("Words to search for; omit to list all customers")] string? text = null,
        [Description("Number of customers to skip, for paging")] int skip = 0,
        [Description("Number of customers to return, at most 100")] int take = 20,
        CancellationToken cancellationToken = default)
    {
        skip = Math.Max(skip, 0);
        take = Math.Clamp(take, 0, MaxTake);

        var customers = db.Customers.AsNoTracking();
        foreach (var word in (text ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            customers = customers.Where(c => c.FirstName.Contains(word) || c.LastName.Contains(word)
                || (c.City != null && c.City.Contains(word)) || (c.Country != null && c.Country.Contains(word)));
        }

        var totalCount = await customers.CountAsync(cancellationToken);
        var page = await customers
            .OrderBy(c => c.LastName).ThenBy(c => c.FirstName).ThenBy(c => c.Id)
            .Skip(skip).Take(take)
            .Select(c => new CustomerSummary(c.Id, c.FirstName, c.LastName, c.City, c.Country, c.Phone, c.Orders.Count))
            .ToListAsync(cancellationToken);
        return new CustomerSearchResult(totalCount, skip, take, page);
    }

    [McpServerTool(Name = "get_customer", Title = "Get a customer and their orders", ReadOnly = true, Idempotent = true,
        UseStructuredContent = true)]
    [Description("Gets one customer, with a summary of each of their orders, most recent first, and the total they have spent.")]
    public static async Task<CustomerDetails> GetCustomer(
        NorthwindContext db,
        [Description("The customer's id")] int customerId,
        CancellationToken cancellationToken = default)
    {
        var customer = await db.Customers.AsNoTracking()
            .Where(c => c.Id == customerId)
            .Select(c => new CustomerSummary(c.Id, c.FirstName, c.LastName, c.City, c.Country, c.Phone, c.Orders.Count))
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new McpException($"There is no customer with id {customerId}.");

        var orders = await db.Orders.AsNoTracking()
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.OrderDate).ThenByDescending(o => o.Id)
            .Select(o => new OrderSummary(o.Id, o.OrderNumber, DateOnly.FromDateTime(o.OrderDate), o.TotalAmount, o.OrderItems.Count))
            .ToListAsync(cancellationToken);

        return new CustomerDetails(customer, orders.Sum(o => o.TotalAmount ?? 0), orders);
    }

    [McpServerTool(Name = "get_order", Title = "Get an order with its items", ReadOnly = true, Idempotent = true,
        UseStructuredContent = true)]
    [Description("Gets one order, by id or by order number, with its customer and its items, including each item's "
        + "product and the product's supplier.")]
    public static async Task<OrderDetails> GetOrder(
        NorthwindContext db,
        [Description("The order's id; give this or orderNumber")] int? orderId = null,
        [Description("The order number, e.g. \"542378\"; give this or orderId")] string? orderNumber = null,
        CancellationToken cancellationToken = default)
    {
        if (orderId == null && string.IsNullOrWhiteSpace(orderNumber))
        {
            throw new McpException("Give either orderId or orderNumber.");
        }

        var orders = db.Orders.AsNoTracking();
        orders = orderId != null ? orders.Where(o => o.Id == orderId) : orders.Where(o => o.OrderNumber == orderNumber!.Trim());

        var order = await orders
            .Select(o => new OrderDetails(
                o.Id, o.OrderNumber, DateOnly.FromDateTime(o.OrderDate), o.TotalAmount,
                new CustomerSummary(o.Customer.Id, o.Customer.FirstName, o.Customer.LastName,
                    o.Customer.City, o.Customer.Country, o.Customer.Phone, o.Customer.Orders.Count),
                o.OrderItems.OrderBy(i => i.Id).Select(i => new OrderItemDetails(
                    i.ProductId, i.Product.ProductName, i.Product.Package, i.Product.IsDiscontinued,
                    i.Product.Supplier.CompanyName, i.UnitPrice, i.Quantity, i.UnitPrice * i.Quantity)).ToList()))
            .FirstOrDefaultAsync(cancellationToken);

        return order ?? throw new McpException(orderId != null
            ? $"There is no order with id {orderId}."
            : $"There is no order with number '{orderNumber}'.");
    }

    [McpServerTool(Name = "top_products", Title = "Top-selling products", ReadOnly = true, Idempotent = true,
        UseStructuredContent = true)]
    [Description("Ranks products by sales revenue or by units sold, optionally only counting orders placed between "
        + "two dates.  Use this for questions about sales totals, which the query tool can't answer because it "
        + "can't add things up.")]
    public static async Task<TopProductsResult> TopProducts(
        NorthwindContext db,
        [Description("How many products to return, at most 100")] int take = 10,
        [Description("Rank by \"revenue\" (the default) or \"quantity\"")] string rankBy = "revenue",
        [Description("Only count orders placed on or after this date")] DateOnly? from = null,
        [Description("Only count orders placed on or before this date")] DateOnly? to = null,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, MaxTake);
        rankBy = rankBy.Trim().ToLowerInvariant();
        if (rankBy != "revenue" && rankBy != "quantity")
        {
            throw new McpException($"rankBy must be \"revenue\" or \"quantity\", not \"{rankBy}\".");
        }

        var items = db.OrderItems.AsNoTracking();
        if (from is { } fromDate)
        {
            var start = fromDate.ToDateTime(TimeOnly.MinValue);
            items = items.Where(i => i.Order.OrderDate >= start);
        }
        if (to is { } toDate)
        {
            var end = toDate.AddDays(1).ToDateTime(TimeOnly.MinValue);
            items = items.Where(i => i.Order.OrderDate < end);
        }

        var totals = items.GroupBy(i => i.ProductId).Select(g => new
        {
            ProductId = g.Key,
            Revenue = g.Sum(i => i.UnitPrice * i.Quantity),
            Quantity = g.Sum(i => i.Quantity),
            OrderCount = g.Select(i => i.OrderId).Distinct().Count(),
        });
        var ranked = rankBy == "quantity"
            ? totals.OrderByDescending(t => t.Quantity).ThenByDescending(t => t.Revenue)
            : totals.OrderByDescending(t => t.Revenue).ThenByDescending(t => t.Quantity);
        var top = await ranked.ThenBy(t => t.ProductId).Take(take).ToListAsync(cancellationToken);

        var productIds = top.Select(t => t.ProductId).ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new { p.Id, p.ProductName, p.IsDiscontinued, SupplierName = p.Supplier.CompanyName })
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        var sales = top.Select(t =>
        {
            var p = products[t.ProductId];
            return new ProductSales(t.ProductId, p.ProductName, p.SupplierName, p.IsDiscontinued, t.Revenue, t.Quantity, t.OrderCount);
        }).ToList();
        return new TopProductsResult(from, to, rankBy, sales);
    }
}
```
These are ordinary EF Core queries, each projected into one of our result records:

 - **`search_customers`** uses the same rule as the search box in the Angular client: every word must appear in
   the first name, last name, city or country.  The comparison is done by SQL Server, so whether it ignores case
   and accents depends on the database's collation.  It pages like the client too, with a stable sort.
 - **`get_customer`** returns the customer, with a summary of each order and the total spent.
 - **`get_order`** projects the order, its customer, and each item's product and supplier in a single query.
   It returns the price on the order item - what the customer actually paid - rather than the product's current
   price.
 - **`top_products`** groups the order items by product in the database, and adds up revenue, units and the number
   of distinct orders.  The date range includes the whole of the `to` day.

Each throws an `McpException` with a useful message when it can't answer, for example "There is no customer with
id 9999."

## Offer the metadata as a resource

Create `Mcp/BreezeResources.cs`:
```csharp
using System.ComponentModel;
using ModelContextProtocol.Server;
using NorthwindModel.Models;

namespace NorthwindServer.Mcp;

/// <summary>
/// MCP resources describing the Breeze data model.
/// </summary>
[McpServerResourceType]
public class BreezeResources
{
    [McpServerResource(UriTemplate = "breeze://metadata", Name = "metadata", Title = "Breeze metadata",
        MimeType = "application/json")]
    [Description("The Breeze metadata for the data model: every entity type with its data properties, keys, "
        + "validators and navigation properties.  This is the same metadata the Breeze client uses.  "
        + "For a shorter summary, call the describe_model tool.")]
    public static string Metadata(NorthwindContext db) => new NorthwindPersistenceManager(db).Metadata();
}
```
A resource is something the client can read, by its URI.  This one returns the same Breeze metadata that the
`metadata` command line argument writes, which describes every entity type in full, including validators.  Most
of the time the `describe_model` tool's summary is more useful to an assistant, but the full metadata is there
when it needs the detail.

## Configure the Program class

Now we register the MCP server, and make the endpoint available.  Edit `Program.cs`.

Add these `using`s at the top:
```csharp
using NorthwindServer.Mcp;
using ModelContextProtocol;
using System.Text.Json;
using System.Text.Json.Serialization;
```

### Register the MCP server

After the `AddDbContext` call, add:
```csharp
// MCP server, giving AI assistants read-only access to the data at /mcp.
// The tools' results always include null values: by default they're left out, but the output schemas
// describe every property as required, and clients reject results that don't match their schema.
var mcpJsonOptions = new JsonSerializerOptions(McpJsonUtilities.DefaultOptions)
{
    DefaultIgnoreCondition = JsonIgnoreCondition.Never,
};
builder.Services.AddMcpServer()
    .WithHttpTransport(options => options.Stateless = true)
    .WithTools<BreezeQueryTools>(mcpJsonOptions)
    .WithTools<NorthwindTools>(mcpJsonOptions)
    .WithResources<BreezeResources>();
```
 - `AddMcpServer()` adds the MCP server to the app's services
 - `WithHttpTransport` serves it over HTTP.  `Stateless = true` means each request stands alone, with no session
   kept between requests.  Our tools don't need sessions, and stateless servers are simpler to run and scale
 - `WithTools<T>` and `WithResources<T>` register our tool and resource classes

**Why the JSON options?**  By default, the SDK leaves null values out of structured results.  But the output
schema it publishes lists every property of a result record as required - including nullable ones, such as a
customer's `City` or a property's `MaxLength`.  So a result with a null in it doesn't match its own schema, and
clients that check, as Claude Code does, reject it.  Copying the SDK's default options and setting
`DefaultIgnoreCondition = JsonIgnoreCondition.Never` makes the tools always write nulls, so every result matches
its schema.

### Keep web pages away from the endpoint

The server's CORS policy allows any web page to call it, which is convenient for the Angular client in development.
But applied to the whole server, it would also let any web page you visit call the MCP endpoint, and read the
data.  So we turn the policy into a named one, and apply it to the Breeze controller only.

Replace the `AddCors` call with:
```csharp
// Allow any origin - development only!
// The policy is applied to the Breeze controller only, so web pages can't call the MCP endpoint.
builder.Services.AddCors(options => options.AddPolicy("BreezeClient", policy => policy
    .AllowAnyHeader()
    .AllowAnyMethod()
    .SetIsOriginAllowed((host) => true)
    .AllowCredentials()
));
```
and replace the `app.UseCors(...)` call, and the `app.MapControllers()` that follows it, with:
```csharp
app.UseCors();

app.MapControllers().RequireCors("BreezeClient");
app.MapMcp("/mcp");
```
`UseCors()` with no policy only applies policies that endpoints ask for; `RequireCors("BreezeClient")` asks for it
on the controllers.  The MCP endpoint has no CORS policy, so a browser won't let a web page on another origin call
it.

`MapMcp("/mcp")` serves the MCP server at `/mcp`.

### Let the tests start the app

At the very end of `Program.cs`, after the `WriteMetadata` function, add:
```csharp
// Lets the integration tests start the app with WebApplicationFactory<Program>
public partial class Program;
```
With top-level statements, the compiler generates a `Program` class that other projects can't see.  Declaring it
`public partial` makes it public, so the test project can start the whole app with `WebApplicationFactory<Program>`.

## Restrict the host names

A server on `localhost` can still be reached from a web page through a trick called *DNS rebinding*, where an
attacker's domain name is made to point at your machine.  The requests then arrive with the attacker's host name.
The MCP SDK's guidance is to accept only the host names you expect.

ASP.NET Core does that with the `AllowedHosts` setting.  In `appsettings.json`, change it from `"*"` to:
```json
  "AllowedHosts": "localhost;127.0.0.1;[::1]"
```
A request with any other host name now gets a `400 Bad Request`.  This applies to the whole server, including the
Breeze controller, so if you run the server under another name, add it to the list.

## Try it out

Build and run the server.  The MCP endpoint is at http://localhost:4000/mcp.  It speaks JSON-RPC, so a browser
won't show much, but you can call it with `curl`.  To list the tools:
```
curl -X POST http://localhost:4000/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}"
```
The answer comes back as a server-sent event: an `event: message` line, then a line starting with `data: `,
followed by JSON listing the six tools, each with its description, arguments and annotations.  To call one:
```
curl -X POST http://localhost:4000/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"search_customers\",\"arguments\":{\"text\":\"maria berlin\"}}}"
```
which finds Maria Anders of Berlin.

### Connect Claude Code

To let Claude Code use the server, create a file called `.mcp.json` at the root of the repository:
```json
{
  "mcpServers": {
    "northwind": {
      "type": "http",
      "url": "http://localhost:4000/mcp"
    }
  }
}
```
Claude Code reads it when a session starts in the repository, and asks you to approve the server, since it comes
from a project file.  Run `/mcp` in Claude Code to check that "northwind" is connected.

`.mcp.json` is meant to be committed, so everyone who works in the repository gets the server.  To add it for
yourself only, use the Claude Code command line instead of the file:
```
claude mcp add --transport http northwind http://localhost:4000/mcp
```

Claude Code loads the list of tools when it connects, so after you change the tools, restart the server and start
a new session, or reconnect from `/mcp`.

Now try asking: *"In northwind, who are our top 5 customers in Germany by total spent?"*  Claude finds the German
customers with `search_customers`, gets each one's total with `get_customer`, and ranks them.  Horst Kloss of
Cunewalde comes out far ahead, at 117,483.39.

## Test the MCP server

The tests start the real server in memory, replace SQL Server with EF's in-memory database holding a small set of
data, and talk to `/mcp` through the SDK's own MCP client - the same way a real client does.

### Create the test project

From the `NorthwindNet10` directory:
```
dotnet new xunit -n NorthwindServer.Tests -f net10.0
dotnet sln add NorthwindServer.Tests/NorthwindServer.Tests.csproj
dotnet add NorthwindServer.Tests reference NorthwindServer/NorthwindServer.csproj
dotnet add NorthwindServer.Tests package Microsoft.AspNetCore.Mvc.Testing --version 10.0.13
dotnet add NorthwindServer.Tests package Microsoft.EntityFrameworkCore.InMemory --version 10.0.13
dotnet add NorthwindServer.Tests package ModelContextProtocol --version 2.3.0
dotnet add NorthwindServer.Tests package JsonSchema.Net --version 9.5.0
dotnet add NorthwindServer.Tests package Newtonsoft.Json --version 13.0.4
```
and delete the generated `UnitTest1.cs`.

 - `Microsoft.AspNetCore.Mvc.Testing` provides `WebApplicationFactory`, which runs the app in memory
 - `Microsoft.EntityFrameworkCore.InMemory` is the in-memory database.  Use the same version as the server's EF Core
 - `ModelContextProtocol` provides the MCP client
 - `JsonSchema.Net` checks results against the tools' output schemas
 - `Newtonsoft.Json` is here only to pin its version.  Without it, the test project ends up with an older version
   than the server is built against, and the query tool fails at run time with a `MissingMethodException`

### Start the server with test data

Create `NorthwindServerFactory.cs`:
```csharp
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;
using NorthwindModel.Models;

namespace NorthwindServer.Tests;

/// <summary>
/// Runs the real server in memory, with the SQL Server database replaced by an in-memory one
/// holding a small, known set of data.
/// </summary>
public class NorthwindServerFactory : WebApplicationFactory<Program>
{
    private readonly string databaseName = "Northwind-" + Guid.NewGuid();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<NorthwindContext>>();
            services.RemoveAll(typeof(IDbContextOptionsConfiguration<NorthwindContext>));
            services.AddDbContext<NorthwindContext>(options => options.UseInMemoryDatabase(databaseName));
        });
    }

    /// <summary> Starts the server if necessary, seeds the database once, and connects an MCP client to /mcp. </summary>
    public async Task<McpClient> CreateMcpClientAsync()
    {
        var http = CreateClient();
        using (var scope = Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<NorthwindContext>();
            if (!await db.Customers.AnyAsync())
            {
                TestData.Seed(db);
            }
        }
        var transport = new HttpClientTransport(new HttpClientTransportOptions
        {
            Endpoint = new Uri(http.BaseAddress!, "mcp"),
            TransportMode = HttpTransportMode.StreamableHttp,
        }, http);
        return await McpClient.CreateAsync(transport);
    }
}

public static class McpTestExtensions
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    /// <summary> Calls a tool, failing the test if it reports an error. </summary>
    public static async Task<CallToolResult> CallToolOkAsync(this McpClient client, string name, Dictionary<string, object?>? arguments = null)
    {
        var result = await client.CallToolAsync(name, arguments ?? []);
        Assert.False(result.IsError == true, $"{name} failed: {result.Text()}");
        return result;
    }

    /// <summary> The tool's structured result, as one of the server's result records. </summary>
    public static T Structured<T>(this CallToolResult result) =>
        JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(result.StructuredContent, Options), Options)!;

    /// <summary> The text of the tool's first content block. </summary>
    public static string Text(this CallToolResult result) =>
        result.Content.OfType<TextContentBlock>().FirstOrDefault()?.Text ?? "";
}
```
`ConfigureWebHost` replaces the server's `DbContext` registration with one that uses the in-memory database.
`CreateMcpClientAsync` seeds the data, and connects an `McpClient` to `/mcp` through the factory's `HttpClient`,
so the requests go straight to the in-memory server.  The extension methods make tool calls shorter to write.

Create `TestData.cs`, with data small enough that every expected answer can be worked out by hand:
```csharp
using NorthwindModel.Models;

namespace NorthwindServer.Tests;

/// <summary> A small set of Northwind data whose answers are easy to work out by hand. </summary>
public static class TestData
{
    public static void Seed(NorthwindContext db)
    {
        var exotic = new Supplier { Id = 1, CompanyName = "Exotic Liquids", City = "London", Country = "UK" };
        var tokyo = new Supplier { Id = 2, CompanyName = "Tokyo Traders", City = "Tokyo", Country = "Japan" };

        var chai = new Product { Id = 1, ProductName = "Chai", Supplier = exotic, UnitPrice = 18m, Package = "10 boxes x 20 bags" };
        var konbu = new Product { Id = 2, ProductName = "Konbu", Supplier = tokyo, UnitPrice = 6m, Package = "2 kg box" };
        var tofu = new Product { Id = 3, ProductName = "Tofu", Supplier = tokyo, UnitPrice = 23.25m, Package = "40 - 100 g pkgs.", IsDiscontinued = true };

        var maria = new Customer { Id = 1, FirstName = "Maria", LastName = "Anders", City = "Berlin", Country = "Germany", Phone = "030-0074321" };
        var hanna = new Customer { Id = 2, FirstName = "Hanna", LastName = "Moos", City = "Mannheim", Country = "Germany", Phone = "0621-08460" };
        var paul = new Customer { Id = 3, FirstName = "Paul", LastName = "Henriot", City = "Reims", Country = "France", Phone = "26.47.15.10" };

        // Maria: two orders, 440 + 93 = 533.  Hanna: one order, 360.  Paul: none.
        var order1 = new Order
        {
            Id = 1, OrderNumber = "542378", OrderDate = new DateTime(2012, 7, 4), Customer = maria, TotalAmount = 440m,
            OrderItems =
            {
                new OrderItem { Id = 1, Product = chai, UnitPrice = 18m, Quantity = 10 },    // 180
                new OrderItem { Id = 2, Product = konbu, UnitPrice = 6.5m, Quantity = 40 },  // 260
            },
        };
        var order2 = new Order
        {
            Id = 2, OrderNumber = "542379", OrderDate = new DateTime(2014, 3, 1), Customer = maria, TotalAmount = 93m,
            OrderItems = { new OrderItem { Id = 3, Product = tofu, UnitPrice = 23.25m, Quantity = 4 } },  // 93
        };
        var order3 = new Order
        {
            Id = 3, OrderNumber = "542380", OrderDate = new DateTime(2014, 5, 1), Customer = hanna, TotalAmount = 360m,
            OrderItems = { new OrderItem { Id = 4, Product = chai, UnitPrice = 18m, Quantity = 20 } },   // 360
        };

        db.AddRange(maria, hanna, paul, order1, order2, order3);
        db.SaveChanges();
    }
}
```

### The tests

The tests are in [McpServerTests.cs](NorthwindNet10/NorthwindServer.Tests/McpServerTests.cs).  They check:

 - **The server:** that it lists the six tools, all read-only, with output schemas where expected; that it offers
   the metadata resource; that it rejects requests with other host names; and that the Breeze controller still
   answers queries
 - **`describe_model`:** the entity sets, keys, maximum lengths and navigations
 - **`query`:** filtering, sorting and counting; `or` and `startswith`; `any` on a collection; `expand` three
   levels deep; that related entities that weren't expanded are left out; `select` with a related property; the
   page size limits; and the error messages for an unknown entity set, an unknown property and malformed JSON
 - **The other tools:** their answers for the test data - for example, that Maria Anders spent 440 + 93 = 533, and
   that Chai's revenue is 10 x 18 + 20 x 18 = 540 - and their error messages

One test deserves a closer look, because it catches a whole class of bugs:
```csharp
// Arguments that make each tool return a full result, with every kind of value in it
public static TheoryData<string, Dictionary<string, object?>> ToolCalls => new()
{
    { "describe_model", new() },
    { "search_customers", new() { ["text"] = "Germany" } },
    { "get_customer", new() { ["customerId"] = 1 } },
    { "get_order", new() { ["orderId"] = 1 } },
    { "top_products", new() { ["from"] = "2012-01-01", ["to"] = "2014-12-31" } },
};

[Theory]
[MemberData(nameof(ToolCalls))]
public async Task Results_match_the_tools_output_schemas(string toolName, Dictionary<string, object?> arguments)
{
    // Clients such as Claude Code check structured results against the output schema, including formats
    // like "date-time", and reject a result that doesn't match
    var tool = (await client.ListToolsAsync()).Single(t => t.Name == toolName);
    var schema = Json.Schema.JsonSchema.FromText(tool.ProtocolTool.OutputSchema!.Value.GetRawText());
    var result = await client.CallToolOkAsync(toolName, arguments);

    var structured = JsonDocument.Parse(JsonSerializer.Serialize(result.StructuredContent)).RootElement;
    var evaluation = schema.Evaluate(structured, new Json.Schema.EvaluationOptions
    {
        RequireFormatValidation = true,
        OutputFormat = Json.Schema.OutputFormat.List,
    });

    var errors = (evaluation.Details ?? [])
        .Where(d => d.Errors != null)
        .SelectMany(d => d.Errors!.Select(e => $"{d.InstanceLocation}: {e.Value}"))
        .Distinct()
        .Take(30);
    Assert.True(evaluation.IsValid, $"{toolName} result doesn't match its schema:\n{string.Join("\n", errors)}");
}
```
It calls each tool that has an output schema, and checks the result against that schema with
`RequireFormatValidation`, so formats such as `"date-time"` are checked too - exactly what Claude Code does with
every result.  It catches both problems described above: `DateTime`s with no time zone, and nulls left out of
results.  The date problem first showed up in Claude Code, which rejected the results, although every other test
passed, because those tests only read the results.  This test reproduced it, and then found the null problem,
before any client had run into it.

One difference between the test database and SQL Server: the in-memory database compares strings case-sensitively,
while SQL Server's default collation doesn't.  So the search test looks for "Maria Berlin", where the server would
also find "maria berlin".

### Run the tests

From the `NorthwindNet10` directory:
```
dotnet test NorthwindServer.Tests
```
> If the server is running in Visual Studio, it locks the files in the server's `bin` folder, and the test
> build fails with "The process cannot access the file".  Stop the server first, or build the tests into another
> folder with `dotnet test NorthwindServer.Tests --artifacts-path <some other folder>`.

## Lessons learned

A few things that cost time, and are worth remembering for the next MCP server on top of Breeze:

 - **Use Breeze's EF Core `ApplyExpand`**, `Breeze.Persistence.EFCore.EFExtensions.ApplyExpand`, not the one in
   Breeze.Core, when running a Breeze query outside a controller
 - **Return result records, not entities.**  Entities refer back to each other, and their shape depends on what was
   loaded
 - **Don't let an empty or missing collection say "none" when it means "not loaded."**  An assistant will believe it
 - **Results must match their output schemas,** formats included.  Use `DateOnly` for dates without a time, write
   nulls, and test every tool's result against its schema
 - **Keep the endpoint local:** restrict the host names, and don't let a permissive CORS policy cover it
 - **Write the tool descriptions for the assistant.**  They're how it decides what to call, and with what

## Next steps

The MCP server is read-only, and it has no authentication: anything that can reach `localhost:4000` can read the
data.  That's fine for a local demo.  Before going further:

 - **Authentication.**  The SDK's ASP.NET Core package includes an MCP authentication handler, based on OAuth, and
   can hide tools from users who aren't authorized to use them
 - **Saving changes.**  A tool that saves through the persistence manager's `SaveChanges` could let an assistant
   update data.  The SDK lets you mark such a tool `Destructive`, so clients ask before running it.  It should
   wait until there's authentication
<hr>
If you have problems with this demo, please create issues in this github repo.

If you have questions about Breeze, please ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/breeze).

If you need help developing your application, please contact us at [IdeaBlade](mailto:info@ideablade.com).
