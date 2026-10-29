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
