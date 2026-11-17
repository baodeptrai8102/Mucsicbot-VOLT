// ============================================================================
// 1. RENDER 0.1 vCPU SURVIVAL: Explicitly set FFMPEG_PATH at the VERY TOP
//    before importing any ZiPlayer or voice audio modules.
// ============================================================================
import ffmpegStatic from "ffmpeg-static";
if (ffmpegStatic) {
  process.env.FFMPEG_PATH = ffmpegStatic;
}

// Suppress Node.js ExperimentalWarning (e.g. JSON module imports from youtubei.js)
// to prevent Render from displaying stderr warning flags
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (
    warning.name === "ExperimentalWarning" ||
    warning.name === "DeprecationWarning" ||
    warning.message.includes("ExperimentalWarning")
  ) {
    return;
  }
  console.warn(warning.name, warning.message);
});

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
import { Client, GatewayIntentBits, ActivityType, Events } from "discord.js";
import { PlayerManager } from "ziplayer";
import { CONFIG } from "./config";
import { handleMessageCreate } from "./events/messageCreate";
import { handleInteractionCreate } from "./events/interactionCreate";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate";
import { registerPlayerEvents } from "./events/playerEvents";

// Native dynamic import helper to load pure ES Modules (@ziplayer/plugin) in CommonJS
const importEsm = new Function("specifier", "return import(specifier)") as <T = any>(
  specifier: string
) => Promise<T>;

// Initialize Discord Client with required Gateway Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Bootstrap application asynchronously
async function bootstrap(): Promise<void> {
  console.log("🔄 [ZiPlayer] Đang nạp các plugin âm thanh...");

  // Dynamically load pure ES Module plugins from @ziplayer/plugin
  const {
    YouTubePlugin,
    SoundCloudPlugin,
    SpotifyPlugin,
    TTSPlugin,
    AttachmentsPlugin
  } = await importEsm<typeof import("@ziplayer/plugin")>("@ziplayer/plugin");

  const soundCloudPlugin = new SoundCloudPlugin();
  (soundCloudPlugin as any).ready?.catch((err: any) => {
    console.log("⚠️ [SoundCloud] Không thể kết nối SoundCloud từ mạng máy chủ:", err?.message || err);
  });

  // Configure high-speed YouTube stream pipeline bypassing datacenter 403 blocks
  const youtubePlugin = new YouTubePlugin({
    fistStream: async (track: any) => {
      try {
        const id = track.id || track.url?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
        if (!id) return null;
        const yt = (youtubePlugin as any).client;
        if (!yt) return null;
        const webStream = await yt.download(id, {
          type: "audio",
          quality: "best",
          client: "IOS"
        });
        const { Readable } = await import("stream");
        return {
          stream: Readable.fromWeb(webStream as any),
          type: "arbitrary"
        };
      } catch (err) {
        return null;
      }
    },
    fallbackStream: async (track: any) => {
      try {
        const id = track.id || track.url?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
        if (!id) return null;
        const yt = (youtubePlugin as any).client;
        if (!yt) return null;
        const webStream = await yt.download(id, {
          type: "audio",
          quality: "best",
          client: "ANDROID"
        });
        const { Readable } = await import("stream");
        return {
          stream: Readable.fromWeb(webStream as any),
          type: "arbitrary"
        };
      } catch (err) {
        return null;
      }
    }
  } as any);

  // Initialize ZiPlayer PlayerManager singleton ONCE at application startup
  const playerManager = new PlayerManager({
    plugins: [
      new TTSPlugin({ defaultLang: "vi" }),
      youtubePlugin,
      soundCloudPlugin,
      new SpotifyPlugin(),
      new AttachmentsPlugin({ maxFileSize: 25 * 1024 * 1024 }) // 25MB max
    ],
    autoCleanup: true
  });

  // Register ZiPlayer Manager Events
  registerPlayerEvents(playerManager, client);
  console.log("✅ [ZiPlayer] Hệ thống âm thanh đã sẵn sàng!");

  // Register Discord Client Event Listeners
  const onReady = (c: any) => {
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
  };

  client.once(Events.ClientReady, onReady);

  // MessageCreate Handler for Prefix Commands (!)
  client.on("messageCreate", handleMessageCreate);

  // InteractionCreate Handler for UI Buttons and Dropdown Controls
  client.on("interactionCreate", handleInteractionCreate);

  // VoiceStateUpdate Handler: 1-minute auto leave when channel is empty
  client.on("voiceStateUpdate", handleVoiceStateUpdate);

  // Log In to Discord
  if (!CONFIG.TOKEN) {
    console.log(
      "⚠️ [CHÚ Ý] Chưa cấu hình DISCORD_TOKEN! Vui lòng thêm biến môi trường DISCORD_TOKEN trên Render Dashboard."
    );
  } else {
    console.log("🔄 Đang kết nối vào Discord Gateway...");
    await client.login(CONFIG.TOKEN);
  }
}

// Start bot
bootstrap().catch((err) => {
  console.error("❌ Failed to start VOLT MUSIC BOT:", err);
});
