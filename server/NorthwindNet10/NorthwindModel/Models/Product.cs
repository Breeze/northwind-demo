using System;
using System.Collections.Generic;

namespace NorthwindModel.Models;

public partial class Product
{
    public int Id { get; set; }

    public string ProductName { get; set; } = null!;

    public int SupplierId { get; set; }

    public decimal? UnitPrice { get; set; }

    public string? Package { get; set; }

    public bool IsDiscontinued { get; set; }

    public virtual ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();

    public virtual Supplier Supplier { get; set; } = null!;
}
