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
