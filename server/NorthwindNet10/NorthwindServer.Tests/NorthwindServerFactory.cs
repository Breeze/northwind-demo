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
