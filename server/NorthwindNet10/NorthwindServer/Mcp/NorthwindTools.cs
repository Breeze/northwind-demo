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
