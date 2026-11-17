import express from "express";
import { CONFIG } from "./config";

export function startKeepAliveServer(): express.Express {
  const app = express();

  app.get("/", (_req, res) => {
    res.status(200).json({
      status: "online",
      service: "VOLT MUSIC BOT",
      platform: "Render Free Tier (0.1 vCPU Optimized)",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  app.get("/health", (_req, res) => {
    res.status(200).send("OK");
  });

  app.listen(CONFIG.PORT, () => {
    console.log(`[KeepAlive] HTTP keep-alive server listening on port ${CONFIG.PORT}`);
  });

  return app;
}
