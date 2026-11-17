import { Client, EmbedBuilder, type TextBasedChannel } from "discord.js";
import type { PlayerManager, Player, Track } from "ziplayer";
import {
  createNowPlayingEmbed,
  createPlaybackButtonsRow,
  createControlDropdownRow,
  createErrorEmbed
} from "../ui/playerUi";
import { CONFIG } from "../config";

export function registerPlayerEvents(manager: PlayerManager, client: Client): void {
  // trackStart event: Send Now Playing Embed and interactive components to the channel in player.userdata
  manager.on("trackStart", async (player: Player, track: Track) => {
    try {
      const channel = player.userdata?.channel as any;
      if (!channel || typeof channel.send !== "function") return;

      const embed = createNowPlayingEmbed(track, client.user?.displayAvatarURL());
      const row1 = createPlaybackButtonsRow();
      const row2 = createControlDropdownRow();

      await channel.send({
        embeds: [embed],
        components: [row1, row2]
      });
    } catch (error) {
      console.error(`[Player Event trackStart Error] [Guild ${player.guildId}]:`, error);
    }
  });

  // queueEnd event: When queue finishes
  manager.on("queueEnd", async (player: Player) => {
    try {
      const channel = player.userdata?.channel as any;
      if (!channel || typeof channel.send !== "function") return;

      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(CONFIG.EMBED_COLOR)
            .setTitle("🏁 HÀNG CHỜ ĐÃ KẾT THÚC")
            .setDescription(
              "Tất cả bài hát trong danh sách đã được phát xong. Bot sẽ tự động rời kênh nếu không có thêm yêu cầu mới!"
            )
            .setFooter({ text: "VOLT Music" })
            .setTimestamp()
        ]
      });
    } catch (error) {
      console.error(`[Player Event queueEnd Error] [Guild ${player.guildId}]:`, error);
    }
  });

  // playerError event: Log and safely inform without crashing process
  manager.on("playerError", async (player: Player, error: any, track?: Track) => {
    console.error(`[Player Error] Guild ${player.guildId}:`, error);
    try {
      const channel = player.userdata?.channel as any;
      if (!channel || typeof channel.send !== "function") return;

      const trackInfo = track ? ` khi phát bài **${track.title}**` : "";
      await channel.send({
        embeds: [
          createErrorEmbed(
            `Đã xảy ra sự cố âm thanh${trackInfo}: ${error?.message || "Lỗi xử lý luồng nhạc"}. Đang tự động bỏ qua...`
          )
        ]
      });
    } catch (err) {
      console.error("[Failed to send playerError message]", err);
    }
  });

  // connectionError event: Log connection failures
  manager.on("connectionError", async (player: Player, error: any) => {
    console.error(`[Connection Error] Guild ${player.guildId}:`, error);
    try {
      const channel = player.userdata?.channel as any;
      if (!channel || typeof channel.send !== "function") return;

      await channel.send({
        embeds: [
          createErrorEmbed(
            `Mất kết nối thoại trong kênh: ${error?.message || "Lỗi kết nối Discord Voice Gateway"}`
          )
        ]
      });
    } catch (err) {
      console.error("[Failed to send connectionError message]", err);
    }
  });
}
