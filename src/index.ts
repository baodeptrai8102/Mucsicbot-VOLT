import fs from "node:fs";
import ffmpegPath from "ffmpeg-static";

// =========================================================================
// [QUAN TRỌNG NHẤT - CHỐNG LỖI RENDER 403 FORBIDDEN & TIMEOUT]
// Override globalThis.fetch TRƯỚC KHI khởi tạo PlayerManager:
// Chuyển hướng các request Innertube từ www.youtube.com/youtubei/v1/
// sang youtubei.googleapis.com và đặt User-Agent ứng dụng YouTube Android/iOS.
// Đây là cơ chế bắt buộc để giải mã luồng nhạc mà không bị YouTube chặn IP datacenter Render.
// =========================================================================
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  // 1. Chuyển hướng URL Innertube sang youtubei.googleapis.com
  let modifiedUrl = url;
  if (url.includes("www.youtube.com/youtubei/v1/")) {
    modifiedUrl = url.replace("www.youtube.com/youtubei/v1/", "youtubei.googleapis.com/youtubei/v1/");
  } else if (url.includes("youtube.com/youtubei/v1/")) {
    modifiedUrl = url.replace("youtube.com/youtubei/v1/", "youtubei.googleapis.com/youtubei/v1/");
  }

  // 2. Thiết lập User-Agent và headers của ứng dụng YouTube Android chính thức
  const headers = new Headers(
    init?.headers || (typeof input === "object" && "headers" in input ? (input as any).headers : {})
  );

  const currentUserAgent = headers.get("User-Agent");
  if (!currentUserAgent || currentUserAgent.includes("Node") || currentUserAgent.includes("undici") || currentUserAgent.includes("node-fetch")) {
    headers.set("User-Agent", "com.google.android.youtube/19.29.37 (Linux; U; Android 14; US) gzip");
    headers.set("X-YouTube-Client-Name", "3"); // Android Client ID
    headers.set("X-YouTube-Client-Version", "19.29.37");
  }

  // Gắn Cookie YouTube từ process.env.YOUTUBE_COOKIE nếu có
  if (process.env.YOUTUBE_COOKIE && (modifiedUrl.includes("youtubei.googleapis.com") || modifiedUrl.includes("youtube.com"))) {
    if (!headers.has("Cookie")) {
      headers.set("Cookie", process.env.YOUTUBE_COOKIE);
    }
  }

  // 3. Chỉ gắn timeout 12s (AbortSignal.timeout(12000)) cho request tìm kiếm/metadata (URL chứa /search hoặc /next hoặc /browse),
  // tuyệt đối KHÔNG áp timeout lên stream audio dài.
  const isSearchOrMetadata =
    modifiedUrl.includes("/search") ||
    modifiedUrl.includes("/next") ||
    modifiedUrl.includes("/browse");

  let signal = init?.signal;
  if (isSearchOrMetadata) {
    const timeoutSignal = AbortSignal.timeout(12000);
    if (signal) {
      if ("any" in AbortSignal && typeof (AbortSignal as any).any === "function") {
        signal = (AbortSignal as any).any([signal, timeoutSignal]);
      } else {
        signal = timeoutSignal;
      }
    } else {
      signal = timeoutSignal;
    }
  }

  const modifiedInit: RequestInit = {
    ...init,
    headers,
    signal,
  };

  return originalFetch(modifiedUrl, modifiedInit);
};

console.log("[RenderBypass] Đã kích hoạt override globalThis.fetch chuyển hướng Innertube sang youtubei.googleapis.com (timeout 12s cho search/metadata)");

import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Message,
} from "discord.js";
import {
  AttachmentsPlugin,
  SoundCloudPlugin,
  SpotifyPlugin,
  TTSPlugin,
  YouTubePlugin,
} from "@ziplayer/plugin";
import { Platform } from "youtubei.js";
import { Readable } from "node:stream";

// Đảm bảo Platform.shim.fetch của youtubei.js trỏ đúng vào override fetch
Platform.shim.fetch = globalThis.fetch;
import { getPlayer, PlayerManager } from "ziplayer";
import { checkCooldown, config } from "./config.js";
import * as helpCommand from "./commands/help.js";
import * as interactionCreateEvent from "./events/interactionCreate.js";
import * as playCommand from "./commands/play.js";
import { registerPlayerEvents } from "./events/playerEvents.js";
import { buildQueueEmbed } from "./ui/playerUi.js";
import { startKeepAliveServer } from "./server.js";
import * as voiceStateUpdateEvent from "./events/voiceStateUpdate.js";
import { clearLeaveTimer } from "./events/voiceStateUpdate.js";

// Tích hợp ffmpeg-static rõ ràng cho môi trường Linux, Render và Windows
const resolvedFfmpegPath: string | null = (
  typeof ffmpegPath === "string" ? ffmpegPath : (ffmpegPath as any)?.default || null
);
if (resolvedFfmpegPath) {
  process.env.FFMPEG_PATH = resolvedFfmpegPath;
  if (process.platform !== "win32") {
    try {
      if (fs.existsSync(resolvedFfmpegPath)) {
        fs.chmodSync(resolvedFfmpegPath, 0o755);
        console.log(`[FFmpeg] Đã cấp quyền thực thi (0755) cho Linux binary tại: ${resolvedFfmpegPath}`);
      }
    } catch (chmodErr) {
      console.warn("[FFmpeg] Không thể đặt quyền thực thi chmod:", chmodErr);
    }
  }
}
console.log(`[FFmpeg] Tích hợp FFmpeg-Static thành công tại: ${process.env.FFMPEG_PATH || config.ffmpegPath}`);

// 1. Bộ chống sập toàn cục (Global Crash Handlers)
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("[AntiCrash] Bắt được Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error: Error, origin: string) => {
  console.error(`[AntiCrash] Bắt được Uncaught Exception tại ${origin}:`, error);
});

process.on("uncaughtExceptionMonitor", (error: Error, origin: string) => {
  console.error(`[AntiCrash] Uncaught Exception Monitor tại ${origin}:`, error);
});

// 2. Khởi tạo Discord Client với MessageContent intent để xử lý lệnh prefix !
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Bắt buộc để đọc lệnh tiền tố !
  ],
});

// 3. Khởi tạo PlayerManager chuẩn singleton duy nhất cho toàn bộ ứng dụng (SAU KHI ĐÃ OVERRIDE FETCH)
const youtubeCookie = process.env.YOUTUBE_COOKIE;
const youtubePlugin = new YouTubePlugin({
  clientType: "IOS",
  searchClientType: "IOS",
  cookie: youtubeCookie,
  fistStream: async (track: any) => {
    try {
      const id = track.id || track.url?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
      if (!id) return null;
      const yt = (youtubePlugin as any).client;
      if (!yt) return null;
      const webStream = await yt.download(id, {
        type: "audio",
        quality: "best",
        client: "IOS",
      });
      return {
        stream: Readable.fromWeb(webStream as any),
        type: "arbitrary",
      };
    } catch {
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
        client: "ANDROID",
      });
      return {
        stream: Readable.fromWeb(webStream as any),
        type: "arbitrary",
      };
    } catch {
      return null;
    }
  },
} as any);

const manager = new PlayerManager({
  plugins: [
    youtubePlugin, // YouTubePlugin ưu tiên hàng đầu trước SoundCloud và Spotify
    new SoundCloudPlugin(),
    new SpotifyPlugin(),
    new TTSPlugin({ defaultLang: "vi" }),
    new AttachmentsPlugin({ maxFileSize: 25 * 1024 * 1024 }), // 25MB
  ],
  autoCleanup: true,
});

// Đăng ký sự kiện Player với PlayerManager singleton
registerPlayerEvents(manager, client);

// 4. Bộ phân phối lệnh tiền tố dấu chấm than (Prefix Commands: !)
client.on(Events.MessageCreate, async (message: Message) => {
  // Bỏ qua tin nhắn từ Bot hoặc tin nhắn riêng tư không thuộc server
  if (message.author.bot || !message.guild || !message.content.startsWith(config.prefix)) {
    return;
  }

  // Tách lệnh và tham số
  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const guildId = message.guild.id;

  try {
    switch (commandName) {
      case "play":
      case "p": {
        await playCommand.execute(message, args);
        break;
      }

      case "help":
      case "h":
      case "guide": {
        await helpCommand.execute(message, args);
        break;
      }

      case "skip":
      case "s": {
        const cooldown = checkCooldown(message.author.id, "skip");
        if (cooldown.onCooldown) {
          await message.reply(`⚠️ Vui lòng đợi **${cooldown.remainingSeconds} giây** trước khi bỏ qua tiếp!`);
          return;
        }

        const player = getPlayer(guildId);
        if (!player || !player.isPlaying) {
          await message.reply("❌ Hiện tại không có bài hát nào đang phát để bỏ qua!");
          return;
        }

        const currentTitle = player.currentTrack?.title || "Không rõ";
        const skipped = await player.skip();
        if (skipped) {
          await message.reply(`⏭️ Đã bỏ qua bài hát: **${currentTitle}**! 🌸`);
        } else {
          await message.reply("⚠️ Không thể bỏ qua hoặc danh sách bài hát đã hết!");
        }
        break;
      }

      case "stop": {
        const cooldown = checkCooldown(message.author.id, "stop");
        if (cooldown.onCooldown) {
          await message.reply(`⚠️ Vui lòng đợi **${cooldown.remainingSeconds} giây** trước khi dùng lại!`);
          return;
        }

        const player = getPlayer(guildId);
        if (!player) {
          await message.reply("❌ Bot hiện không phát nhạc trong máy chủ này!");
          return;
        }

        clearLeaveTimer(guildId);
        player.stop();
        player.queue.clear();
        await player.disconnect();
        player.destroy();
        manager.delete(guildId);
        await message.reply("⏹️ **Đã dừng phát nhạc, xóa sạch hàng đợi và rời khỏi kênh thoại.** Hẹn gặp lại Anh Bo! 🌸🦊");
        break;
      }

      case "pause": {
        const player = getPlayer(guildId);
        if (!player || !player.isPlaying) {
          await message.reply("❌ Hiện không có bài hát nào đang phát để tạm dừng!");
          return;
        }

        if (player.isPaused) {
          await message.reply("⚠️ Bài hát hiện tại vốn đã đang tạm dừng rồi!");
        } else {
          player.pause();
          await message.reply("⏸️ Đã tạm dừng bài hát hiện tại. Dùng `!resume` để tiếp tục nhé!");
        }
        break;
      }

      case "resume": {
        const player = getPlayer(guildId);
        if (!player) {
          await message.reply("❌ Trình phát nhạc không hoạt động!");
          return;
        }

        if (!player.isPaused) {
          await message.reply("⚠️ Bài hát đang phát bình thường, không bị tạm dừng!");
        } else {
          player.resume();
          await message.reply("▶️ Đã tiếp tục phát nhạc thành công! 🎶✨");
        }
        break;
      }

      case "loop":
      case "l": {
        // Chức năng BẬT/TẮT lặp lại bài hát (Loop)
        const cooldown = checkCooldown(message.author.id, "loop");
        if (cooldown.onCooldown) {
          await message.reply(`⚠️ Vui lòng đợi **${cooldown.remainingSeconds} giây** trước khi đổi chế độ lặp lại!`);
          return;
        }

        const player = getPlayer(guildId);
        if (!player) {
          await message.reply("❌ Bot hiện không phát nhạc trong máy chủ này!");
          return;
        }

        const currentMode = player.queue.getLoopMode() || "off";
        const newMode = currentMode === "off" ? "track" : "off";
        player.loop(newMode);

        if (newMode === "track") {
          await message.reply("🔂 Đã **BẬT** chế độ lặp lại bài hát hiện tại! (Loop: Track) 🌸");
        } else {
          await message.reply("❌ Đã **TẮT** chế độ lặp lại bài hát! (Loop: Off) ✨");
        }
        break;
      }

      case "queue":
      case "q": {
        const player = getPlayer(guildId);
        if (!player) {
          await message.reply("❌ Hàng đợi hiện đang trống!");
          return;
        }

        const queueEmbed = buildQueueEmbed(player);
        await message.reply({ embeds: [queueEmbed] });
        break;
      }

      case "shuffle": {
        const player = getPlayer(guildId);
        if (!player || player.queue.size < 2) {
          await message.reply("⚠️ Hàng đợi cần ít nhất 2 bài hát để có thể xáo trộn ngẫu nhiên!");
          return;
        }

        player.queue.shuffle();
        await message.reply(`🔀 Đã xáo trộn ngẫu nhiên **${player.queue.size}** bài hát trong hàng đợi! ✨`);
        break;
      }

      case "volume":
      case "vol": {
        const player = getPlayer(guildId);
        if (!player) {
          await message.reply("❌ Trình phát nhạc hiện không hoạt động!");
          return;
        }

        const volumeArg = parseInt(args[0], 10);
        if (isNaN(volumeArg) || volumeArg < 0 || volumeArg > 100) {
          await message.reply(`🔊 Âm lượng hiện tại: \`${player.volume}%\`. Vui lòng chọn mức từ 0 đến 100% để chống rè vỡ tiếng (Ví dụ: \`!volume 80\`) nha Anh Bo! 🌸`);
          return;
        }

        player.setVolume(volumeArg);
        await message.reply(`🔊 Đã điều chỉnh âm lượng thành: \`${volumeArg}%\`! 🎶`);
        break;
      }

      default:
        // Lệnh không khớp
        break;
    }
  } catch (cmdError) {
    console.error(`[MessageCreate] Lỗi khi xử lý lệnh !${commandName}:`, cmdError);
    await message.reply("⚠️ Đã xảy ra lỗi nội bộ khi thực hiện lệnh này. Anh Bo hãy thử lại sau ít phút nhé! 🦊");
  }
});

// 5. Lắng nghe các sự kiện Giao diện Nút bấm và Menu Dropdown
client.on(interactionCreateEvent.name, (interaction) => {
  interactionCreateEvent.execute(interaction);
});

// 6. Lắng nghe sự kiện Kênh thoại (Tự động rời sau ĐÚNG 10 GIÂY trống)
client.on(voiceStateUpdateEvent.name, (oldState, newState) => {
  voiceStateUpdateEvent.execute(oldState, newState);
});

// 7. Sự kiện khi Bot sẵn sàng hoạt động
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🌸 VOLT Music Bot đã sẵn sàng! Đăng nhập thành công dưới tên: ${readyClient.user.tag} 🦊✨`);
  console.log(`[Prefix] Hệ thống tiền tố hoạt động: "${config.prefix}" (Ví dụ: ${config.prefix}play, ${config.prefix}help)`);
  console.log(`[AutoLeave] Cấu hình tự động rời kênh thoại sau: ${config.autoLeaveTimeoutMs / 1000} giây`);

  // Thiết lập trạng thái hoạt động sinh động
  readyClient.user.setPresence({
    activities: [
      {
        name: `${config.prefix}play | Phục vụ Anh Bo OniChan 🌸🦊`,
        type: ActivityType.Listening,
      },
    ],
    status: "online",
  });

  // Khởi động máy chủ HTTP giữ kết nối (Render / Linux Web Service Keep-Alive)
  startKeepAliveServer(client);
});

// 8. Đăng nhập bot
if (!config.token) {
  console.error("❌ LỖI NGHIÊM TRỌNG: Chưa thiết lập biến môi trường DISCORD_TOKEN trong file .env!");
  console.error("Vui lòng cấu hình DISCORD_TOKEN để khởi động bot nhé Anh Bo!");
} else {
  client.login(config.token).catch((loginError) => {
    console.error("❌ Không thể đăng nhập vào Discord Gateway:", loginError);
  });
}

export { client, manager };
