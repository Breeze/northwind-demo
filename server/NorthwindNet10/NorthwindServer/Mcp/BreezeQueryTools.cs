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
