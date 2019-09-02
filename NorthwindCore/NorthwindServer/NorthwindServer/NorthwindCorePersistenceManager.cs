using Breeze.Persistence.EFCore;
using NorthwindModel.Models;

namespace NorthwindServer
{
    public class NorthwindCorePersistenceManager : EFPersistenceManager<NorthwindCoreContext>
    {
        public NorthwindCorePersistenceManager(NorthwindCoreContext dbContext) : base(dbContext) { }
    }
}
