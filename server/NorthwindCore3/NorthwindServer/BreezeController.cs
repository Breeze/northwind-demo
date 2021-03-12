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
            return persistenceManager.Context.Customer;
        }
        [HttpGet]
        public IQueryable<Order> Orders()
        {
            return persistenceManager.Context.Order;
        }
        [HttpGet]
        public IQueryable<Product> Products()
        {
            return persistenceManager.Context.Product;
        }
        [HttpGet]
        public IQueryable<Supplier> Suppliers()
        {
            return persistenceManager.Context.Supplier;
        }
        [HttpPost]
        public ActionResult<SaveResult> SaveChanges([FromBody] JObject saveBundle)
        {
            return persistenceManager.SaveChanges(saveBundle);
        }
    }
}
