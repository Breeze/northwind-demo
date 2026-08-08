using Breeze.AspNetCore;
using Breeze.Core;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Serialization;
using NorthwindModel.Models;
using NorthwindServer;

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
