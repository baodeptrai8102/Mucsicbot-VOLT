import { type Message } from "discord.js";
import { getPlayer } from "ziplayer";
import type { Command } from "./types";
import { createErrorEmbed, createSuccessEmbed } from "../ui/playerUi";

export const shuffleCommand: Command = {
  name: "shuffle",
  description: "Xáo trộn ngẫu nhiên tất cả bài hát trong hàng chờ",
  usage: "!shuffle",
  execute: async (message: Message): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply({
        embeds: [createErrorEmbed("Bạn cần tham gia kênh thoại của bot để trộn nhạc!")]
      });
      return;
    }

    const player = getPlayer(guildId);
    if (!player || player.queue.size < 2) {
      await message.reply({
        embeds: [
          createErrorEmbed("Cần ít nhất 2 bài hát trong hàng chờ để thực hiện xáo trộn!")
        ]
      });
      return;
    }

    player.queue.shuffle();

    await message.reply({
      embeds: [
        createSuccessEmbed(
          "🔀 ĐÃ TRỘN BÀI HÁT",
          `Đã xáo trộn ngẫu nhiên **${player.queue.size}** bài hát trong hàng chờ thành công!`
        )
      ]
    });
  }
};
