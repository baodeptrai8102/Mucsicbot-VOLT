import type { Client, TextChannel } from "discord.js";
import type { Player, PlayerManager, Track } from "ziplayer";
import { IS_RENDER, config } from "../config.js";
import { clearLeaveTimer } from "./voiceStateUpdate.js";
import { buildPlayerActionRows, buildPlayerEmbed } from "../ui/playerUi.js";

/**
 * Bộ chống lặp debounce cho sự kiện queueEnd theo guildId (3000ms)
 */
const lastQueueEndMap = new Map<string, number>();

/**
 * Lấy tiêu đề video YouTube qua endpoint oEmbed (Google Datacenter-safe, không bị chặn IP 403)
 */
async function fetchYouTubeTitleViaOembed(url: string): Promise<string | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return typeof data?.title === "string" ? data.title.trim() : null;
  } catch {
    return null;
  }
}

export function registerPlayerEvents(manager: PlayerManager, client: Client): void {
  // 1. Sự kiện khi bắt đầu phát bài hát mới: Gửi Embed Now Playing + Buttons + Menu Dropdown
  manager.on("trackStart", async (player: Player, track: Track) => {
    console.log(`[PlayerEvents] [${player.guildId}] Bắt đầu phát: ${track.title}`);

    const textChannelId = player.userdata?.textChannelId as string | undefined;
    if (!textChannelId) return;

    try {
      const channel = client.channels.cache.get(textChannelId) as TextChannel | undefined;
      if (!channel || !channel.isTextBased()) return;

      // Xóa tin nhắn Now Playing trước đó nếu có để giữ kênh chat luôn ngăn nắp
      const lastMessageId = player.userdata?.lastNowPlayingMessageId as string | undefined;
      if (lastMessageId) {
        channel.messages.delete(lastMessageId).catch(() => {});
      }

      const embed = buildPlayerEmbed(player, track);
      const components = buildPlayerActionRows(player);

      const sentMessage = await channel.send({
        embeds: [embed],
        components,
      });

      if (!player.userdata) player.userdata = {};
      player.userdata.lastNowPlayingMessageId = sentMessage.id;
    } catch (err) {
      console.error(`[PlayerEvents] Lỗi khi gửi giao diện Now Playing cho guild ${player.guildId}:`, err);
    }
  });

  // 2. Sự kiện khi bài hát kết thúc
  manager.on("trackEnd", (player: Player, track: Track) => {
    console.log(`[PlayerEvents] [${player.guildId}] Kết thúc bài hát: ${track.title}`);
  });

  // 3. Sự kiện khi hàng đợi phát hết bài (Debounce 3000ms chống lặp tin nhắn)
  manager.on("queueEnd", async (player: Player) => {
    const now = Date.now();
    const lastTime = lastQueueEndMap.get(player.guildId) || 0;
    if (now - lastTime < 3000) {
      console.log(`[PlayerEvents] [${player.guildId}] queueEnd bị bỏ qua do debounce (< 3000ms).`);
      return;
    }
    lastQueueEndMap.set(player.guildId, now);

    console.log(`[PlayerEvents] [${player.guildId}] Hàng đợi đã phát hết.`);

    const textChannelId = player.userdata?.textChannelId as string | undefined;
    if (!textChannelId) return;

    try {
      const channel = client.channels.cache.get(textChannelId) as TextChannel | undefined;
      if (!channel) return;

      await channel.send({
        content: `🎶 Hàng đợi đã hoàn tất tất cả các bài hát! Hãy dùng lệnh \`${config.prefix}play <tên bài>\` để tiếp tục thưởng thức cùng tiểu hồ ly nhé Anh Bo OniChan! 🌸🦊`,
      });
    } catch (err) {
      console.error("[PlayerEvents] Lỗi khi gửi thông báo queueEnd:", err);
    }
  });

  // 4. Sự kiện khi xảy ra lỗi phát nhạc
  manager.on("playerError", async (player: Player, error: any, track?: Track) => {
    const trackTitle = track?.title || player.currentTrack?.title || "Không rõ";
    const errorCode = error?.code || error?.name || "STREAM_ERROR";
    const trackUrl = track?.url || player.currentTrack?.url || "";
    console.error(
      `[PlayerEvents] [${player.guildId}] [${trackTitle}] [${errorCode}] Lỗi phát nhạc:`,
      error?.stack || error
    );
    const isYouTube = Boolean(
      (trackUrl && (trackUrl.includes("youtube.com") || trackUrl.includes("youtu.be"))) ||
      (track as any)?.source === "youtube" ||
      (player.currentTrack as any)?.source === "youtube"
    );

    const fallbackKey = `fallbackHandled_${track?.id || trackUrl || trackTitle}`;
    const alreadyFallback = Boolean(
      (player.userdata && player.userdata[fallbackKey]) ||
      ((player as any).data && (player as any).data[fallbackKey])
    );

    // Nếu chạy trên Render (IS_RENDER) và track YouTube bị lỗi chưa được fallback:
    // Tự động giải mã tiêu đề qua oEmbed và chuyển nguồn sang SoundCloud tiếp tục phát mà không bị skip mất bài
    if (IS_RENDER && isYouTube && !alreadyFallback) {
      if (!player.userdata) player.userdata = {};
      player.userdata[fallbackKey] = true;
      if (!(player as any).data) (player as any).data = {};
      (player as any).data[fallbackKey] = true;

      let cleanTitle = trackTitle !== "Không rõ" ? trackTitle : "";
      if (trackUrl && (trackUrl.includes("youtube.com") || trackUrl.includes("youtu.be"))) {
        const oembedTitle = await fetchYouTubeTitleViaOembed(trackUrl);
        if (oembedTitle) {
          cleanTitle = oembedTitle;
        }
      }

      let fallbackSuccess = false;
      try {
        // Skip track đang lỗi để nhả stream
        try {
          if (player.isPlaying || player.currentTrack) {
            player.skip();
          }
        } catch {}

        const scPlugin = ((manager as any).plugins as any[])?.find((p: any) => p.name === "soundcloud");
        if (scPlugin && cleanTitle) {
          const scResult = await scPlugin.search(cleanTitle, track?.requestedBy || "system");
          if (scResult && scResult.tracks && scResult.tracks.length > 0) {
            const scTrack = scResult.tracks[0];
            fallbackSuccess = await player.play(scTrack.url || scTrack, track?.requestedBy || "system");
          }
        }

        if (!fallbackSuccess && cleanTitle) {
          fallbackSuccess = await player.play(`soundcloud:${cleanTitle}`, track?.requestedBy || "system");
        }
      } catch (fbErr) {
        console.warn(`[PlayerEvents] [${player.guildId}] Fallback SoundCloud thất bại:`, fbErr);
      }

      const textChannelId = player.userdata?.textChannelId as string | undefined;
      if (textChannelId) {
        const channel = client.channels.cache.get(textChannelId) as TextChannel | undefined;
        if (channel && channel.isTextBased()) {
          if (fallbackSuccess) {
            await channel.send({
              content: `🔄 Nhận diện luồng YouTube gặp sự cố trên Render (\`${errorCode}\`), tiểu hồ ly đã tự động chuyển bài **${cleanTitle || trackTitle}** sang SoundCloud tiếp tục phát cho Anh Bo rồi nhé! 🌸✨`,
            }).catch(() => {});
            return;
          }
        }
      }
      if (fallbackSuccess) return;
    }

    // Tự động bỏ qua bài bị lỗi để tránh kẹt hàng đợi (khi đã fallback rồi hoặc không phải link YouTube)
    try {
      if (player.isPlaying || player.currentTrack) {
        player.skip();
      }
    } catch {
      // Bỏ qua nếu không thể skip
    }

    const textChannelId = player.userdata?.textChannelId as string | undefined;
    if (!textChannelId) return;

    try {
      const channel = client.channels.cache.get(textChannelId) as TextChannel | undefined;
      if (!channel) return;

      await channel.send({
        content: `⚠️ Bài hát **${trackTitle}** gặp sự cố phát âm thanh (\`${errorCode}\`). Tiểu hồ ly đã tự động chuyển tiếp để không làm gián đoạn danh sách của Anh Bo nha! 🌸✨`,
      });
    } catch (err) {
      console.error(`[PlayerEvents] [${player.guildId}] Lỗi gửi cảnh báo playerError:`, err);
    }
  });

  // 5. Sự kiện khi gặp lỗi kết nối voice
  manager.on("connectionError", async (player: Player, error: any) => {
    const errorCode = error?.code || error?.name || "VOICE_CONNECTION_ERROR";
    const trackTitle = player.currentTrack?.title || "Không có bài";
    console.error(
      `[PlayerEvents] [${player.guildId}] [${trackTitle}] [${errorCode}] Lỗi kết nối kênh thoại:`,
      error?.stack || error
    );

    const textChannelId = player.userdata?.textChannelId as string | undefined;
    if (!textChannelId) return;

    try {
      const channel = client.channels.cache.get(textChannelId) as TextChannel | undefined;
      if (!channel) return;

      await channel.send({
        content: `⚠️ Kết nối kênh thoại gặp sự cố (\`${errorCode}\`). Anh Bo hãy kiểm tra lại quyền hạn hoặc gọi em lại bằng lệnh \`${config.prefix}play\` nhé! 🦊🌸`,
      });
    } catch {
      // Bỏ qua lỗi gửi tin nhắn
    }
  });

  // 6. Sự kiện hủy/xóa player
  manager.on("playerDestroy", (player: Player) => {
    console.log(`[PlayerEvents] [${player.guildId}] Trình phát nhạc đã được dọn dẹp và hủy.`);
    clearLeaveTimer(player.guildId);
    lastQueueEndMap.delete(player.guildId);
    if (player.userdata) {
      player.userdata = {};
    }
  });
}
