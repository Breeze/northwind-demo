using System;
using System.Collections.Generic;

namespace NorthwindModel.Models;

public partial class Supplier
{
    public int Id { get; set; }

    public string CompanyName { get; set; } = null!;

    public string? ContactName { get; set; }

    public string? ContactTitle { get; set; }

    public string? City { get; set; }

    public string? Country { get; set; }

    public string? Phone { get; set; }

    public string? Fax { get; set; }

    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
}
