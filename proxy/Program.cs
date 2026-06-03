var builder = WebApplication.CreateBuilder(args);

// Add YARP reverse proxy
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

// Serve static frontend files from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Map reverse proxy for /api/* routes to Node.js backend
app.MapReverseProxy();

// SPA fallback: serve index.html for any unmatched routes
app.MapFallbackToFile("index.html");

app.Run();
