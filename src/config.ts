import dotenv from "dotenv";
import fs from "node:fs";
import ffmpegPath from "ffmpeg-static";
import { PREDEFINED_FILTERS } from "ziplayer";

dotenv.config();

// Tích hợp ffmpeg-static rõ ràng cho môi trường Linux, Render và Windows
const resolvedFfmpegPath: string | null = (
  typeof ffmpegPath === "string" ? ffmpegPath : (ffmpegPath as any)?.default || null
);

if (resolvedFfmpegPath) {
  process.env.FFMPEG_PATH = resolvedFfmpegPath;
  // Đảm bảo quyền thực thi (chmod 755) trên Linux/Render container
  if (process.platform !== "win32") {
    try {
      if (fs.existsSync(resolvedFfmpegPath)) {
        fs.chmodSync(resolvedFfmpegPath, 0o755);
        console.log(`[FFmpeg] Đã cấp quyền thực thi (0755) cho binary FFmpeg tại: ${resolvedFfmpegPath}`);
      }
    } catch (chmodErr) {
      console.warn("[FFmpeg] Không thể đặt quyền thực thi chmod:", chmodErr);
    }
  }
}

// Bổ sung bộ lọc Crystal vào danh sách PREDEFINED_FILTERS của ziplayer nếu chưa có
if (!PREDEFINED_FILTERS.crystal) {
  PREDEFINED_FILTERS.crystal = {
    name: "crystal",
    ffmpegFilter: "treble=g=8:f=4000:w=0.6,equalizer=f=8000:width_type=h:width=1000:g=6",
    description: "Crystal Clear (Âm thanh sắc nét)",
    category: "eq",
  };
}

export const config = {
  prefix: process.env.PREFIX || "!",
  token: process.env.DISCORD_TOKEN || "",
  clientId: process.env.CLIENT_ID || "",
  port: Number(process.env.PORT) || 3000,
  defaultVolume: Number(process.env.DEFAULT_VOLUME) || 80,
  autoLeaveTimeoutMs: Number(process.env.AUTO_LEAVE_TIMEOUT_MS) || 10_000, // ĐÚNG 10 GIÂY tự động rời kênh thoại khi không còn người nghe
  cooldownSeconds: Number(process.env.COMMAND_COOLDOWN_SECONDS) || 5, // Chống spam lệnh 5 giây
  ffmpegPath: resolvedFfmpegPath || "ffmpeg",
  colors: {
    primary: 0x9b59b6, // Tím Yae Miko thanh lịch
    success: 0x2ecc71,
    warning: 0xf39c12,
    error: 0xe74c3c,
    info: 0x3498db,
  },
};

// Quản lý chống spam lệnh (Cooldown 5 giây theo người dùng)
const cooldownMap = new Map<string, number>();

export function checkCooldown(
  userId: string,
  commandName: string,
  cooldownMs: number = config.cooldownSeconds * 1000
): { onCooldown: boolean; remainingSeconds: number } {
  const key = `${userId}:${commandName}`;
  const now = Date.now();
  const expiration = cooldownMap.get(key);

  if (expiration && now < expiration) {
    const remainingSeconds = Math.ceil((expiration - now) / 1000);
    return { onCooldown: true, remainingSeconds };
  }

  cooldownMap.set(key, now + cooldownMs);

  // Tự động dọn dẹp bộ nhớ cache cooldown
  setTimeout(() => {
    if (cooldownMap.get(key) && Date.now() >= (cooldownMap.get(key) || 0)) {
      cooldownMap.delete(key);
    }
  }, cooldownMs + 1000);

  return { onCooldown: false, remainingSeconds: 0 };
}
