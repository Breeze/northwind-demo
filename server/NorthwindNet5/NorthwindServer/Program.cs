using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using System;

namespace NorthwindServer
{
    public class Program
    {
        public static void Main(string[] args)
        {
            if (args.Length > 0 && args[0].Contains("metadata"))
            {
                // Generate metadata and exit
                var dbContext = new NorthwindModel.Models.NorthwindContext();
                var persistenceManager = new NorthwindPersistenceManager(dbContext);
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
