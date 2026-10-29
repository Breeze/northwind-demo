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
