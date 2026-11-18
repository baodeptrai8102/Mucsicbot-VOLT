import dotenv from "dotenv";

dotenv.config();

export const CONFIG = {
  IS_RENDER: Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID),
  TOKEN: process.env.DISCORD_TOKEN || process.env.TOKEN || "",
  PREFIX: process.env.PREFIX || "!",
  PORT: parseInt(process.env.PORT || "3000", 10),
  DEFAULT_VOLUME: 80,
  SEARCH_TIMEOUT_MS: 45000,
  EMBED_COLOR: 0x00ff66, // Neon Green (#00FF66)
  WARNING_COLOR: 0xffaa00,
  ERROR_COLOR: 0xff3333
} as const;
