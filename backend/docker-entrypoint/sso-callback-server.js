// Minimal SSO callback HTTP server (no dependencies)
// Receives AWS SSO authorization code, signals entrypoint to proceed
const http = require("http");

const PORT = process.env.SSO_CALLBACK_PORT || 8080;
const SIGNAL_FILE = "/tmp/auth_complete";
const fs = require("fs");

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  if (url.pathname === "/sso-callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (code) {
      // Write auth code to signal file for entrypoint to pick up
      fs.writeFileSync(SIGNAL_FILE, JSON.stringify({ code, state }));
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <head><title>AWS Login Successful</title></head>
          <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui;background:#f8fafc;">
            <div style="text-align:center;">
              <div style="width:64px;height:64px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <h1 style="font-size:18px;color:#0f172a;">Authentication Successful</h1>
              <p style="color:#64748b;font-size:14px;">You can close this tab. Terraform is now running.</p>
            </div>
          </body>
        </html>
      `);
    } else {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h1>Error: Missing authorization code</h1>");
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SSO callback server listening on port ${PORT}`);
});
