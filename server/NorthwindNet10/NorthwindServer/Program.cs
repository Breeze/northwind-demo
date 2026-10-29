using Breeze.AspNetCore;
using Breeze.Core;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Serialization;
using NorthwindModel.Models;
using NorthwindServer;
using NorthwindServer.Mcp;
using ModelContextProtocol;
using System.Text.Json;
using System.Text.Json.Serialization;

if (args.Length > 0 && args[0].Contains("metadata"))
{
    // Generate metadata and exit
    WriteMetadata();
    return;
}

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

// Allow any origin - development only!
// The policy is applied to the Breeze controller only, so web pages can't call the MCP endpoint.
builder.Services.AddCors(options => options.AddPolicy("BreezeClient", policy => policy
    .AllowAnyHeader()
    .AllowAnyMethod()
    .SetIsOriginAllowed((host) => true)
    .AllowCredentials()
));

// Add DbContext using connection string
var connectionString = builder.Configuration.GetConnectionString("Northwind");
builder.Services.AddDbContext<NorthwindContext>(options => options.UseSqlServer(connectionString));

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

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseRouting();
app.UseCors();

app.MapControllers().RequireCors("BreezeClient");
app.MapMcp("/mcp");
app.MapGet("/", () => "Hello World!");

app.Run();

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

// Lets the integration tests start the app with WebApplicationFactory<Program>
public partial class Program;
