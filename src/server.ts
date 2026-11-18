import http from "node:http";
import type { Client } from "discord.js";
import { config } from "./config.js";

export function startKeepAliveServer(client?: Client): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      const botStatus = client?.user ? `Online as ${client.user.tag}` : "Initializing";
      const guildsCount = client?.guilds.cache.size ?? 0;
      const uptimeSeconds = Math.floor(process.uptime());

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          {
            status: "ok",
            service: "VOLT Music Bot (Prefix: !)",
            botStatus,
            guilds: guildsCount,
            uptimeSeconds,
            autoLeaveTimeoutMs: config.autoLeaveTimeoutMs,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  const port = Number(process.env.PORT) || config.port || 3000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`[KeepAlive] HTTP Web server listening on 0.0.0.0:${port} for Render/Cloud keep-alive`);
  });

  server.on("error", (err) => {
    console.error("[KeepAlive] Server error:", err);
  });

  return server;
}
