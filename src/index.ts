import "dotenv/config";
import fs from "fs";
import path from "path";
import Module from "module";
import { pathToFileURL } from "url";
import ffmpegStatic from "ffmpeg-static";

// ============================================================================
// 1. THIẾT LẬP FFMPEG CHUẨN CHO CẢ WINDOWS (VS CODE) VÀ LINUX (RENDER)
// ============================================================================
if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(ffmpegStatic, 0o755);
    } catch {
      // Bỏ qua nếu hệ thống đã cấp quyền sẵn
    }
  }
  process.env.FFMPEG_PATH = ffmpegStatic;
}

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
// 2. BỘ CHẶN LỖI TOÀN CỤC (CHỐNG SẬP BOT)
// ============================================================================
process.on("unhandledRejection", (reason: any, promise) => {
  if (
    reason?.message?.includes("Edge TTS") ||
    reason?.message?.includes("getEdgeTTSVoices") ||
    reason?.message?.includes("client_id")
  ) {
    return;
  }
  console.error("[Anti-Crash] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Anti-Crash] Uncaught Exception thrown:", error);
});

// ============================================================================
// 3. SERVER GIỮ KẾT NỐI TRÊN RENDER
// ============================================================================
import { startKeepAliveServer } from "./server";
startKeepAliveServer();

// ============================================================================
// 4. BỘ VƯỢT CHẶN YOUTUBE 403 TRÊN RENDER (YOUTUBEI.GOOGLEAPIS.COM)
// ============================================================================
import { Client, GatewayIntentBits, ActivityType, Events } from "discord.js";
import { CONFIG } from "./config";
import { handleMessageCreate } from "./events/messageCreate";
import { handleInteractionCreate } from "./events/interactionCreate";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate";
import { registerPlayerEvents } from "./events/playerEvents";

const STREAM_PROFILES = [
  {
    name: "ANDROID_VR",
    clientId: "28",
    clientVersion: "1.60.19",
    userAgent:
      "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; Quest 3 Build/SQ3A.220605.009.A1) gzip",
    contextClient: {
      clientName: "ANDROID_VR",
      clientVersion: "1.60.19",
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      osName: "Android",
      osVersion: "12L",
      hl: "vi",
      gl: "VN"
    }
  },
  {
    name: "IOS",
    clientId: "5",
    clientVersion: "19.45.4",
    userAgent:
      "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1 like Mac OS X)",
    contextClient: {
      clientName: "IOS",
      clientVersion: "19.45.4",
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iOS",
      osVersion: "18.1",
      hl: "vi",
      gl: "VN"
    }
  },
  {
    name: "ANDROID",
    clientId: "3",
    clientVersion: "19.45.38",
    userAgent: "com.google.android.youtube/19.45.38 (Linux; U; Android 14) gzip",
    contextClient: {
      clientName: "ANDROID",
      clientVersion: "19.45.38",
      androidSdkVersion: 34,
      osName: "Android",
      osVersion: "14",
      hl: "vi",
      gl: "VN"
    }
  }
] as const;

function installRenderYouTubeBypass(): void {
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    if (urlStr.includes("youtube.com/sw.js_data")) {
      const res = await originalFetch(input, init);
      if (res.ok) return res;
      return new Response(")]}'\n{}", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Giữ đúng User-Agent khớp với tham số c= khi tải luồng âm thanh dài từ googlevideo.com
    if (urlStr.includes("googlevideo.com/videoplayback")) {
      const headers = new Headers(
        init?.headers || (input instanceof Request ? input.headers : undefined)
      );
      if (urlStr.includes("c=IOS")) {
        headers.set("User-Agent", STREAM_PROFILES[1].userAgent);
      } else if (urlStr.includes("c=ANDROID_VR")) {
        headers.set("User-Agent", STREAM_PROFILES[0].userAgent);
      } else if (urlStr.includes("c=ANDROID")) {
        headers.set("User-Agent", STREAM_PROFILES[2].userAgent);
      }
      return originalFetch(urlStr, { ...init, headers });
    }

    // Chuyển hướng API InnerTube sang youtubei.googleapis.com để tránh tường lửa www.youtube.com
    if (urlStr.includes("/youtubei/v1/")) {
      const apiUrl = urlStr.replace(
        /^https?:\/\/(www\.|m\.)?youtube\.com/,
        "https://youtubei.googleapis.com"
      );

      // Với endpoint /search: giữ nguyên payload WEB chuẩn để youtubei.js đọc được kết quả tìm kiếm
      if (urlStr.includes("/youtubei/v1/search")) {
        const headers = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined)
        );
        headers.delete("cookie");
        headers.delete("content-length");
        headers.set("Origin", "https://www.youtube.com");
        headers.set("Referer", "https://www.youtube.com/");
        return originalFetch(apiUrl, { ...init, headers });
      }

      // Với /player và /next: dùng profile ANDROID_VR / IOS / ANDROID để lấy luồng âm thanh gốc
      let rawBody: string | null = null;
      if (typeof init?.body === "string") {
        rawBody = init.body;
      } else if (input instanceof Request) {
        try {
          rawBody = await input.clone().text();
        } catch {
          rawBody = null;
        }
      }

      if (rawBody) {
        let parsedBody: Record<string, any> | null = null;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = null;
        }

        if (parsedBody && typeof parsedBody === "object") {
          for (const profile of STREAM_PROFILES) {
            const headers = new Headers();
            headers.set("Content-Type", "application/json");
            headers.set("User-Agent", profile.userAgent);
            headers.set("X-YouTube-Client-Name", profile.clientId);
            headers.set("X-YouTube-Client-Version", profile.clientVersion);

            const cleanPayload: Record<string, any> = {
              context: {
                client: { ...profile.contextClient }
              }
            };

            if (parsedBody.videoId) cleanPayload.videoId = parsedBody.videoId;
            if (parsedBody.playlistId) cleanPayload.playlistId = parsedBody.playlistId;
            if (parsedBody.params) cleanPayload.params = parsedBody.params;
            if (parsedBody.query) cleanPayload.query = parsedBody.query;
            if (parsedBody.continuation) cleanPayload.continuation = parsedBody.continuation;
            if (parsedBody.browseId) cleanPayload.browseId = parsedBody.browseId;
            cleanPayload.contentCheckOk = true;
            cleanPayload.racyCheckOk = true;

            try {
              const res = await originalFetch(apiUrl, {
                method: "POST",
                headers,
                body: JSON.stringify(cleanPayload),
                signal: init?.signal
              });

              if (res.ok) {
                return res;
              }
            } catch {
              // Thử sang profile tiếp theo
            }
          }
        }
      }
    }

    return originalFetch(input, init);
  };
}

const importEsm = new Function("specifier", "return import(specifier)") as <T = any>(
  specifier: string
) => Promise<T>;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

function extractImportTarget(val: unknown): string | null {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    for (const key of ["import", "node", "default"]) {
      if (key in obj) {
        const found = extractImportTarget(obj[key]);
        if (found) return found;
      }
    }
    for (const v of Object.values(obj)) {
      const found = extractImportTarget(v);
      if (found) return found;
    }
  }
  return null;
}

async function preloadAllEsmPackages(): Promise<void> {
  const preloadedCache = new Map<string, any>();
  const fileToSpecifiers = new Map<string, Set<string>>();

  const skipPackages = new Set<string>([
    "ziplayer",
    "youtubei.js",
    "discord.js",
    "ffmpeg-static",
    "opusscript",
    "typescript",
    "tsx",
    "dotenv"
  ]);
  const skipPrefixes = ["@ziplayer/", "@discordjs/", "@types/", "@snazzah/"];

  const registerTarget = (filePath: string, specifier?: string) => {
    try {
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return;
      const realPath = fs.realpathSync(filePath);
      if (!fileToSpecifiers.has(realPath)) {
        fileToSpecifiers.set(realPath, new Set<string>());
      }
      const specs = fileToSpecifiers.get(realPath)!;
      specs.add(filePath);
      specs.add(realPath);
      if (specifier) specs.add(specifier);
    } catch {
      // Bỏ qua file không đọc được
    }
  };

  const inspectPackage = (pkgDir: string, pkgName: string) => {
    if (
      skipPackages.has(pkgName) ||
      skipPrefixes.some((prefix) => pkgName.startsWith(prefix))
    ) {
      return;
    }

    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) return;

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      const isTypeModule = pkg.type === "module";

      if (typeof pkg.module === "string") {
        registerTarget(path.resolve(pkgDir, pkg.module), pkgName);
      }

      if (typeof pkg.main === "string" && (isTypeModule || pkg.main.endsWith(".mjs"))) {
        registerTarget(path.resolve(pkgDir, pkg.main), pkgName);
      }

      if (typeof pkg.exports === "string") {
        if (isTypeModule || pkg.exports.endsWith(".mjs")) {
          registerTarget(path.resolve(pkgDir, pkg.exports), pkgName);
        }
      } else if (pkg.exports && typeof pkg.exports === "object") {
        const exportsObj = pkg.exports as Record<string, unknown>;
        const keys = Object.keys(exportsObj);

        if (keys.some((k) => k.startsWith("."))) {
          for (const subpath of keys) {
            const target = extractImportTarget(exportsObj[subpath]);
            if (!target) continue;

            if (!subpath.includes("*")) {
              const spec = subpath === "." ? pkgName : `${pkgName}/${subpath.slice(2)}`;
              registerTarget(path.resolve(pkgDir, target), spec);
            } else if (subpath === "./*" && target.endsWith("/*.js")) {
              const targetDir = path.resolve(pkgDir, target.slice(0, -5));
              if (fs.existsSync(targetDir)) {
                for (const f of fs.readdirSync(targetDir)) {
                  if (f.endsWith(".js") && !f.endsWith(".test.js")) {
                    registerTarget(path.join(targetDir, f), `${pkgName}/${f}`);
                  }
                }
              }
            }
          }
        } else {
          const rootTarget = extractImportTarget(exportsObj);
          if (rootTarget) {
            registerTarget(path.resolve(pkgDir, rootTarget), pkgName);
          }
        }
      }

      if (isTypeModule || pkgName.startsWith("@exodus/") || pkgName.startsWith("@asamuzakjp/")) {
        for (const f of fs.readdirSync(pkgDir)) {
          if ((f.endsWith(".js") || f.endsWith(".mjs")) && !f.endsWith(".test.js")) {
            registerTarget(path.join(pkgDir, f), `${pkgName}/${f}`);
          }
        }
      }
    } catch {
      // Bỏ qua package.json lỗi
    }
  };

  const scanNodeModules = (nmDir: string, depth = 0) => {
    if (depth > 4 || !fs.existsSync(nmDir)) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(nmDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const fullPath = path.join(nmDir, entry.name);

      if (entry.name.startsWith("@")) {
        let subEntries: fs.Dirent[];
        try {
          subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const sub of subEntries) {
          if (!sub.isDirectory()) continue;
          const pkgPath = path.join(fullPath, sub.name);
          inspectPackage(pkgPath, `${entry.name}/${sub.name}`);
          scanNodeModules(path.join(pkgPath, "node_modules"), depth + 1);
        }
      } else {
        inspectPackage(fullPath, entry.name);
        scanNodeModules(path.join(fullPath, "node_modules"), depth + 1);
      }
    }
  };

  scanNodeModules(path.join(process.cwd(), "node_modules"));

  await Promise.allSettled(
    Array.from(fileToSpecifiers.entries()).map(async ([realPath, specifiers]) => {
      const mod = await importEsm<any>(pathToFileURL(realPath).href);
      for (const spec of specifiers) {
        preloadedCache.set(spec, mod);
      }
    })
  );

  if (preloadedCache.size > 0) {
    const originalLoad = (Module as any)._load;
    (Module as any)._load = function (request: string, parent: any, isMain: boolean) {
      if (preloadedCache.has(request)) {
        return preloadedCache.get(request);
      }
      try {
        const resolved = (Module as any)._resolveFilename(request, parent, isMain);
        if (preloadedCache.has(resolved)) {
          return preloadedCache.get(resolved);
        }
        if (fs.existsSync(resolved)) {
          const real = fs.realpathSync(resolved);
          if (preloadedCache.has(real)) {
            return preloadedCache.get(real);
          }
        }
      } catch {
        // Dùng trình nạp mặc định
      }
      return originalLoad.apply(this, arguments);
    };
  }
}

async function bootstrap(): Promise<void> {
  console.log("🔄 [ZiPlayer] Đang nạp các plugin âm thanh...");

  const isRender = Boolean(
    CONFIG.IS_RENDER || process.env.RENDER || process.env.RENDER_SERVICE_ID
  );

  if (isRender) {
    installRenderYouTubeBypass();
  }

  await preloadAllEsmPackages();

  const { PlayerManager } = await importEsm<typeof import("ziplayer")>("ziplayer");
  const {
    YouTubePlugin,
    SoundCloudPlugin,
    SpotifyPlugin,
    TTSPlugin,
    AttachmentsPlugin
  } = await importEsm<typeof import("@ziplayer/plugin")>("@ziplayer/plugin");

  const youtubePlugin = new YouTubePlugin();
  const soundCloudPlugin = new SoundCloudPlugin();
  if ((soundCloudPlugin as any).ready) {
    await Promise.race([
      (soundCloudPlugin as any).ready.catch((err: any) => {
        console.log("⚠️ [SoundCloud Backup] Đang khởi tạo lại:", err?.message || err);
      }),
      new Promise((resolve) => setTimeout(resolve, 3500))
    ]);
  }

  const spotifyPlugin = new SpotifyPlugin();

  // Giữ nguyên SoundCloud & Spotify hoạt động bình thường,
  // chỉ ngăn 2 plugin này tự ý phát thay thế khi bài hát gốc là YouTube
  const isYouTubeTrack = (track: any): boolean => {
    if (!track) return false;
    const src = String(track.source || "").toLowerCase();
    const url = String(track.url || "");
    return src === "youtube" || /(?:youtube\.com|youtu\.be)/i.test(url);
  };

  for (const secondaryPlugin of [soundCloudPlugin, spotifyPlugin]) {
    const origGetStream = (secondaryPlugin as any).getStream?.bind(secondaryPlugin);
    if (typeof origGetStream === "function") {
      (secondaryPlugin as any).getStream = async (track: any, ...args: any[]) => {
        if (isYouTubeTrack(track)) {
          throw new Error("SKIP_YOUTUBE_STREAM_HIJACK");
        }
        return origGetStream(track, ...args);
      };
    }
  }

  const plugins: any[] = [youtubePlugin, soundCloudPlugin, spotifyPlugin];
  if (!isRender) {
    const ttsPlugin = new TTSPlugin({ defaultLang: "vi" });
    (ttsPlugin as any).ready?.catch?.(() => {});
    const attachmentsPlugin = new AttachmentsPlugin({ maxFileSize: 25 * 1024 * 1024 });
    plugins.push(ttsPlugin, attachmentsPlugin);
  }

  const playerManager = new PlayerManager({
    plugins,
    autoCleanup: true
  });

  registerPlayerEvents(playerManager, client);
  console.log(
    `✅ [ZiPlayer] Sẵn sàng! Môi trường: ${
      isRender ? "Render Cloud (YouTube Priority)" : "Local VS Code (YouTube Priority)"
    }`
  );

  const onReady = (c: any) => {
    console.log(`=======================================================`);
    console.log(`⚡ VOLT MUSIC BOT is ONLINE!`);
    console.log(`🤖 Logged in as: ${c.user.tag} (ID: ${c.user.id})`);
    console.log(`⚙️ Prefix: "${CONFIG.PREFIX}"`);
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
  client.on("error", (err) => console.error("[Discord Client Error]:", err));
  client.on("messageCreate", handleMessageCreate);
  client.on("interactionCreate", handleInteractionCreate);
  client.on("voiceStateUpdate", handleVoiceStateUpdate);

  if (!CONFIG.TOKEN) {
    console.log("⚠️ [CHÚ Ý] Thiếu DISCORD_TOKEN trong file .env hoặc Render Environment!");
  } else {
    console.log("🔄 Đang kết nối vào Discord Gateway...");
    await client.login(CONFIG.TOKEN);
  }

  const shutdown = () => {
    try {
      client.destroy();
    } catch {
      // Bỏ qua lỗi khi đóng kết nối
    }
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}