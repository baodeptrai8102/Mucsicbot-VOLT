// ============================================================================
// 1. RENDER 0.1 vCPU SURVIVAL: Explicitly set FFMPEG_PATH at the VERY TOP
//    before importing any ZiPlayer or voice audio modules.
// ============================================================================
import ffmpegStatic from "ffmpeg-static";
if (ffmpegStatic) {
  process.env.FFMPEG_PATH = ffmpegStatic;
}

// ============================================================================
// 2. ZERO-CRASH SAFETY NET: Global Error Interceptors
// ============================================================================
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Anti-Crash] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Anti-Crash] Uncaught Exception thrown:", error);
});

// ============================================================================
// 3. HTTP KEEP-ALIVE SERVER: Render Port Binding & Sleep Prevention
// ============================================================================
import { startKeepAliveServer } from "./server";
startKeepAliveServer();

// ============================================================================
// 4. ZIPLAYER & DISCORD CLIENT INITIALIZATION
// ============================================================================
import { Client, GatewayIntentBits, ActivityType } from "discord.js";
import { PlayerManager } from "ziplayer";
import {
  YouTubePlugin,
  SoundCloudPlugin,
  SpotifyPlugin,
  TTSPlugin,
  AttachmentsPlugin
} from "@ziplayer/plugin";
import { CONFIG } from "./config";
import { handleMessageCreate } from "./events/messageCreate";
import { handleInteractionCreate } from "./events/interactionCreate";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate";
import { registerPlayerEvents } from "./events/playerEvents";

// Initialize Discord Client with required Gateway Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Initialize ZiPlayer PlayerManager singleton ONCE at application startup
const playerManager = new PlayerManager({
  plugins: [
    new TTSPlugin({ defaultLang: "vi" }),
    new YouTubePlugin(),
    new SoundCloudPlugin(),
    new SpotifyPlugin(),
    new AttachmentsPlugin({ maxFileSize: 25 * 1024 * 1024 }) // 25MB max
  ],
  autoCleanup: true
});

// Register ZiPlayer Manager Events
registerPlayerEvents(playerManager, client);

// Register Discord Client Event Listeners
client.once("ready", (c) => {
  console.log(`=======================================================`);
  console.log(`⚡ VOLT MUSIC BOT is ONLINE!`);
  console.log(`🤖 Logged in as: ${c.user.tag} (ID: ${c.user.id})`);
  console.log(`⚙️ Prefix: "${CONFIG.PREFIX}" (Prefix Commands Only)`);
  console.log(`🚀 Optimized for Render 0.1 vCPU & 512MB RAM`);
  console.log(`=======================================================`);

  c.user.setPresence({
    activities: [
      {
        name: `${CONFIG.PREFIX}play | VOLT MUSIC ⚡`,
        type: ActivityType.Listening
      }
    ],
    status: "online"
  });
});

// MessageCreate Handler for Prefix Commands (!)
client.on("messageCreate", handleMessageCreate);

// InteractionCreate Handler for UI Buttons and Dropdown Controls
client.on("interactionCreate", handleInteractionCreate);

// VoiceStateUpdate Handler: 1-minute auto leave when channel is empty
client.on("voiceStateUpdate", handleVoiceStateUpdate);

// Log In to Discord
if (!CONFIG.TOKEN) {
  console.warn(
    "⚠️ [WARNING] DISCORD_TOKEN is not set in environment or .env file! Please set DISCORD_TOKEN to run the bot."
  );
} else {
  client.login(CONFIG.TOKEN).catch((err) => {
    console.error("❌ Failed to log in to Discord:", err);
  });
}
