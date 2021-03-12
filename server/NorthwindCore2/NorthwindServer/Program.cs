using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using NorthwindModel.Models;
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
                var dbContext = new NorthwindContext();
                var persistenceManager = new NorthwindPersistenceManager(dbContext);
                var metadata = persistenceManager.Metadata();
                Console.OutputEncoding = System.Text.Encoding.UTF8;
                Console.Out.WriteLine(metadata);
            }
            else
            {
                // Start web server
                CreateWebHostBuilder(args).Build().Run();
            }
        }

        public static IWebHostBuilder CreateWebHostBuilder(string[] args) =>
            WebHost.CreateDefaultBuilder(args)
                .UseStartup<Startup>();
    }
}
