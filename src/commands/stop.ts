import { type Message } from "discord.js";
import { getPlayer } from "ziplayer";
import type { Command } from "./types";
import { createErrorEmbed, createSuccessEmbed } from "../ui/playerUi";

export const stopCommand: Command = {
  name: "stop",
  description: "Dừng phát nhạc, xóa danh sách phát và rời khỏi kênh thoại",
  usage: "!stop",
  execute: async (message: Message): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply({
        embeds: [createErrorEmbed("Bạn cần tham gia kênh thoại của bot để dừng nhạc!")]
      });
      return;
    }

    const player = getPlayer(guildId);
    if (!player) {
      await message.reply({
        embeds: [createErrorEmbed("Hiện không có trình phát nhạc nào đang hoạt động!")]
      });
      return;
    }

    await player.stop();
    player.destroy();

    await message.reply({
      embeds: [
        createSuccessEmbed(
          "⏹️ ĐÃ DỪNG PHÁT",
          "Đã dừng phát nhạc, dọn dẹp hàng chờ và ngắt kết nối khỏi kênh thoại."
        )
      ]
    });
  }
};
