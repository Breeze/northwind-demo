using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NorthwindModel.Models;

namespace NorthwindServer
{
    public class Program
    {
        public static void Main(string[] args)
        {
            if (args.Length > 0 && args[0].Contains("metadata"))
            {
                // Generate metadata and exit
                var dbContext = new NorthwindCoreContext();
                var persistenceManager = new NorthwindCorePersistenceManager(dbContext);
                var metadata = persistenceManager.Metadata();
                Console.Out.WriteLine(metadata);
            }
            else
            {
                // Start web server
                CreateHostBuilder(args).Build().Run();
            }
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                });
    }
}
