using Breeze.AspNetCore;
using Breeze.Persistence;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using NorthwindModel.Models;
using System.Linq;

namespace NorthwindServer
{
    [Route("api/[controller]/[action]")]
    [BreezeQueryFilter]
    public class BreezeController : Controller
    {
        private NorthwindPersistenceManager persistenceManager;
        public BreezeController(NorthwindContext dbContext)
        {
            persistenceManager = new NorthwindPersistenceManager(dbContext);
        }

        [HttpGet]
        public IQueryable<Customer> Customers()
        {
            return persistenceManager.Context.Customers;
        }
        [HttpGet]
        public IQueryable<Order> Orders()
        {
            return persistenceManager.Context.Orders;
        }
        [HttpGet]
        public IQueryable<Product> Products()
        {
            return persistenceManager.Context.Products;
        }
        [HttpGet]
        public IQueryable<Supplier> Suppliers()
        {
            return persistenceManager.Context.Suppliers;
        }

        [HttpPost]
        public ActionResult<SaveResult> SaveChanges([FromBody] JObject saveBundle)
        {
            return persistenceManager.SaveChanges(saveBundle);
        }
    }
}
