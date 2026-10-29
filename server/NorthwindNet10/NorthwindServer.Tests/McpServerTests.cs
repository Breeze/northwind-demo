using System.Net;
using System.Text.Json;
using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;
using NorthwindServer.Mcp;

namespace NorthwindServer.Tests;

public class McpServerTests(NorthwindServerFactory factory) : IClassFixture<NorthwindServerFactory>, IAsyncLifetime
{
    private McpClient client = null!;

    public async Task InitializeAsync() => client = await factory.CreateMcpClientAsync();

    public async Task DisposeAsync() => await client.DisposeAsync();

    // Calls the query tool and returns its JSON result
    private async Task<JsonElement> Query(string entitySet, string? query = null)
    {
        var result = await client.CallToolOkAsync("query", new() { ["entitySet"] = entitySet, ["query"] = query });
        return JsonDocument.Parse(result.Text()).RootElement;
    }

    private async Task<string> QueryError(string entitySet, string? query)
    {
        var result = await client.CallToolAsync("query", new Dictionary<string, object?> { ["entitySet"] = entitySet, ["query"] = query });
        Assert.True(result.IsError);
        return result.Text();
    }

    private static string[] Names(JsonElement results, string property) =>
        results.EnumerateArray().Select(r => r.GetProperty(property).GetString()!).ToArray();

    // --- the server ---

    [Fact]
    public async Task Lists_the_tools_all_read_only()
    {
        var tools = await client.ListToolsAsync();

        Assert.Equal(
            ["describe_model", "get_customer", "get_order", "query", "search_customers", "top_products"],
            tools.Select(t => t.Name).Order());
        Assert.All(tools, t => Assert.True(t.ProtocolTool.Annotations?.ReadOnlyHint));
        // Every tool but query has a fixed result shape, described by an output schema
        Assert.All(tools.Where(t => t.Name != "query"), t => Assert.NotNull(t.ProtocolTool.OutputSchema));
    }

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

    [Fact]
    public async Task Offers_the_Breeze_metadata_as_a_resource()
    {
        var resources = await client.ListResourcesAsync();
        Assert.Contains(resources, r => r.Uri == "breeze://metadata");

        var contents = await client.ReadResourceAsync("breeze://metadata");
        var text = Assert.IsType<TextResourceContents>(Assert.Single(contents.Contents)).Text;
        var shortNames = JsonDocument.Parse(text).RootElement.GetProperty("structuralTypes").EnumerateArray()
            .Select(t => t.GetProperty("shortName").GetString());
        Assert.Contains("Customer", shortNames);
    }

    [Fact]
    public async Task Rejects_requests_for_other_host_names()
    {
        var http = factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "/mcp");
        request.Headers.Host = "attacker.example.com";
        var response = await http.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Breeze_controller_still_answers_queries()
    {
        var response = await factory.CreateClient().GetStringAsync("/api/breeze/Customers");
        Assert.Equal(3, JsonDocument.Parse(response).RootElement.GetArrayLength());
    }

    // --- describe_model ---

    [Fact]
    public async Task Describes_the_entity_sets_with_their_properties_and_navigations()
    {
        var model = (await client.CallToolOkAsync("describe_model")).Structured<ModelDescription>();

        Assert.Equal(["Customers", "OrderItems", "Orders", "Products", "Suppliers"], model.EntitySets.Select(s => s.EntitySet));
        var customers = model.EntitySets.Single(s => s.EntitySet == "Customers");
        Assert.True(customers.Properties.Single(p => p.Name == "Id").IsKey);
        Assert.Equal(40, customers.Properties.Single(p => p.Name == "LastName").MaxLength);
        var orders = customers.Navigations.Single(n => n.Name == "Orders");
        Assert.True(orders.IsCollection);
        Assert.Equal("Order", orders.Target);
        Assert.Equal("Order.CustomerId", orders.ForeignKey);
    }

    // --- query ---

    [Fact]
    public async Task Query_filters_sorts_and_counts()
    {
        var json = await Query("Customers", """{"where":{"Country":"Germany"},"orderBy":["LastName desc"],"take":1}""");

        Assert.Equal(2, json.GetProperty("TotalCount").GetInt32());
        Assert.Equal(1, json.GetProperty("Returned").GetInt32());
        Assert.Equal(["Moos"], Names(json.GetProperty("Results"), "LastName"));
    }

    [Fact]
    public async Task Query_combines_conditions()
    {
        var json = await Query("Customers", """{"where":{"or":[{"City":"Reims"},{"LastName":{"startswith":"Mo"}}]},"orderBy":["Id"]}""");
        Assert.Equal(["Moos", "Henriot"], Names(json.GetProperty("Results"), "LastName"));
    }

    [Fact]
    public async Task Query_can_test_related_collections()
    {
        var json = await Query("Orders", """{"where":{"OrderItems":{"any":{"Quantity":{"ge":40}}}}}""");
        Assert.Equal(["542378"], Names(json.GetProperty("Results"), "OrderNumber"));
    }

    [Fact]
    public async Task Query_expands_related_entities()
    {
        var json = await Query("Orders", """{"where":{"Id":1},"expand":["Customer","OrderItems.Product.Supplier"]}""");

        var order = json.GetProperty("Results")[0];
        Assert.Equal("Anders", order.GetProperty("Customer").GetProperty("LastName").GetString());
        var items = order.GetProperty("OrderItems");
        Assert.Equal(2, items.GetArrayLength());
        Assert.Equal("Exotic Liquids", items[0].GetProperty("Product").GetProperty("Supplier").GetProperty("CompanyName").GetString());
        // The customer's Orders would only point back to this order, so it's left out rather than shown as empty
        Assert.False(order.GetProperty("Customer").TryGetProperty("Orders", out _));
    }

    [Fact]
    public async Task Query_leaves_out_related_entities_that_were_not_expanded()
    {
        var customer = (await Query("Customers", """{"where":{"Id":1}}""")).GetProperty("Results")[0];
        // Maria has orders, but they weren't asked for; an empty list would wrongly say she has none
        Assert.False(customer.TryGetProperty("Orders", out _));
    }

    [Fact]
    public async Task Query_selects_properties_including_related_ones()
    {
        var json = await Query("Orders", """{"where":{"Id":3},"select":["OrderNumber","Customer.LastName"]}""");

        var row = json.GetProperty("Results")[0];
        Assert.Equal("542380", row.GetProperty("OrderNumber").GetString());
        Assert.Equal("Moos", row.GetProperty("Customer_LastName").GetString());
    }

    [Fact]
    public async Task Query_returns_25_by_default_and_at_most_100()
    {
        Assert.Equal(BreezeQueryTools.DefaultTake, (await Query("OrderItems")).GetProperty("Take").GetInt32());
        Assert.Equal(BreezeQueryTools.MaxTake, (await Query("OrderItems", """{"take":5000}""")).GetProperty("Take").GetInt32());
    }

    [Fact]
    public async Task Query_explains_an_unknown_entity_set()
    {
        var error = await QueryError("Widgets", null);
        Assert.Contains("There is no entity set named 'Widgets'", error);
        Assert.Contains("Customers, OrderItems, Orders, Products, Suppliers", error);
    }

    [Theory]
    [InlineData("""{"where":{"Nope":1}}""", "Nope")]
    [InlineData("""{"where":""", "not valid")]
    public async Task Query_explains_an_invalid_query(string query, string expected)
    {
        var error = await QueryError("Customers", query);
        Assert.Contains("The query is not valid", error);
        Assert.Contains(expected, error);
    }

    // --- search_customers ---

    [Fact]
    public async Task Search_requires_every_word_to_match()
    {
        // Matching is case-insensitive on SQL Server, but the in-memory test database is case-sensitive
        var result = (await client.CallToolOkAsync("search_customers", new() { ["text"] = "Maria Berlin" })).Structured<CustomerSearchResult>();

        var maria = Assert.Single(result.Customers);
        Assert.Equal("Anders", maria.LastName);
        Assert.Equal(2, maria.OrderCount);
    }

    [Fact]
    public async Task Search_without_text_lists_everyone_by_name_a_page_at_a_time()
    {
        var result = (await client.CallToolOkAsync("search_customers", new() { ["skip"] = 1, ["take"] = 1 })).Structured<CustomerSearchResult>();

        Assert.Equal(3, result.TotalCount);
        Assert.Equal(["Henriot"], result.Customers.Select(c => c.LastName));  // Anders, [Henriot], Moos
    }

    // --- get_customer ---

    [Fact]
    public async Task Gets_a_customer_with_their_orders_and_total()
    {
        var details = (await client.CallToolOkAsync("get_customer", new() { ["customerId"] = 1 })).Structured<CustomerDetails>();

        Assert.Equal("Maria", details.Customer.FirstName);
        Assert.Equal(533m, details.TotalSpent);
        Assert.Equal(["542379", "542378"], details.Orders.Select(o => o.OrderNumber));  // most recent first
        Assert.Equal(2, details.Orders.Last().ItemCount);
    }

    [Fact]
    public async Task Get_customer_explains_an_unknown_id()
    {
        var result = await client.CallToolAsync("get_customer", new Dictionary<string, object?> { ["customerId"] = 99 });
        Assert.True(result.IsError);
        Assert.Contains("There is no customer with id 99", result.Text());
    }

    // --- get_order ---

    [Fact]
    public async Task Gets_an_order_by_number_with_its_items_products_and_suppliers()
    {
        var order = (await client.CallToolOkAsync("get_order", new() { ["orderNumber"] = "542378" })).Structured<OrderDetails>();

        Assert.Equal(1, order.Id);
        Assert.Equal("Anders", order.Customer.LastName);
        Assert.Equal(["Chai", "Konbu"], order.Items.Select(i => i.ProductName));
        var konbu = order.Items[1];
        Assert.Equal("Tokyo Traders", konbu.SupplierName);
        Assert.Equal(6.5m, konbu.UnitPrice);     // the price on the order, not the product's current 6.00
        Assert.Equal(260m, konbu.LineTotal);
    }

    [Fact]
    public async Task Gets_an_order_by_id()
    {
        var order = (await client.CallToolOkAsync("get_order", new() { ["orderId"] = 2 })).Structured<OrderDetails>();
        Assert.True(Assert.Single(order.Items).IsDiscontinued);
    }

    [Fact]
    public async Task Get_order_needs_an_id_or_number()
    {
        var result = await client.CallToolAsync("get_order", new Dictionary<string, object?>());
        Assert.True(result.IsError);
        Assert.Contains("Give either orderId or orderNumber", result.Text());
    }

    // --- top_products ---

    [Fact]
    public async Task Ranks_products_by_revenue()
    {
        var result = (await client.CallToolOkAsync("top_products")).Structured<TopProductsResult>();

        Assert.Equal(["Chai", "Konbu", "Tofu"], result.Products.Select(p => p.ProductName));
        var chai = result.Products[0];
        Assert.Equal(540m, chai.Revenue);  // 10 x 18 + 20 x 18
        Assert.Equal(30, chai.Quantity);
        Assert.Equal(2, chai.OrderCount);
        Assert.Equal("Exotic Liquids", chai.SupplierName);
    }

    [Fact]
    public async Task Ranks_products_by_quantity_within_dates()
    {
        var result = (await client.CallToolOkAsync("top_products",
            new() { ["rankBy"] = "quantity", ["from"] = "2014-01-01", ["to"] = "2014-12-31" })).Structured<TopProductsResult>();

        // Only orders 2 and 3 are in 2014: 20 Chai and 4 Tofu
        Assert.Equal(["Chai", "Tofu"], result.Products.Select(p => p.ProductName));
        Assert.Equal([20, 4], result.Products.Select(p => p.Quantity));
    }

    [Fact]
    public async Task Top_products_explains_an_unknown_ranking()
    {
        var result = await client.CallToolAsync("top_products", new Dictionary<string, object?> { ["rankBy"] = "profit" });
        Assert.True(result.IsError);
        Assert.Contains("rankBy must be", result.Text());
    }
}
