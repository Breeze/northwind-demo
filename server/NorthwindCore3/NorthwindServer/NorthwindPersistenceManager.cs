using Breeze.Persistence.EFCore;
using NorthwindModel.Models;

namespace NorthwindServer
{
    public class NorthwindPersistenceManager : EFPersistenceManager<NorthwindContext>
    {
        public NorthwindPersistenceManager(NorthwindContext dbContext) : base(dbContext) { }

    }
}
