import type { Client, TextChannel } from "discord.js";
import type { Player, PlayerManager, Track } from "ziplayer";
import { config } from "../config.js";
import { clearLeaveTimer } from "./voiceStateUpdate.js";
import { buildPlayerActionRows, buildPlayerEmbed } from "../ui/playerUi.js";

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

  // 3. Sự kiện khi hàng đợi phát hết bài
  manager.on("queueEnd", async (player: Player) => {
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
    const errorMessage = error?.message || String(error);
    console.error(`[PlayerEvents] [${player.guildId}] [${trackTitle}] [${errorCode}] Lỗi phát nhạc: ${errorMessage}`);

    // Tự động bỏ qua bài bị lỗi để tránh kẹt hàng đợi
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
    console.error(`[PlayerEvents] [${player.guildId}] [${errorCode}] Lỗi kết nối kênh thoại:`, error?.message || error);

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
    if (player.userdata) {
      player.userdata = {};
    }
  });
}
