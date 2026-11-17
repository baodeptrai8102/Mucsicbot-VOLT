import { type Message } from "discord.js";
import { getPlayer } from "ziplayer";
import type { Command } from "./types";
import { createErrorEmbed, createSuccessEmbed } from "../ui/playerUi";

export const volumeCommand: Command = {
  name: "volume",
  aliases: ["vol"],
  description: "Điều chỉnh mức âm lượng phát nhạc từ 0 đến 200%",
  usage: "!volume <0-200>",
  execute: async (message: Message, args: string[]): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply({
        embeds: [createErrorEmbed("Bạn cần tham gia kênh thoại của bot để chỉnh âm lượng!")]
      });
      return;
    }

    const player = getPlayer(guildId);
    if (!player) {
      await message.reply({
        embeds: [createErrorEmbed("Hiện không có bài hát nào đang phát!")]
      });
      return;
    }

    const input = args[0];
    if (!input) {
      await message.reply({
        embeds: [
          createSuccessEmbed(
            "🔊 ÂM LƯỢNG",
            `Mức âm lượng hiện tại: **${player.volume}%**\nCách đổi: \`!volume <0-200>\``
          )
        ]
      });
      return;
    }

    const amount = parseInt(input, 10);
    if (isNaN(amount) || amount < 0 || amount > 200) {
      await message.reply({
        embeds: [
          createErrorEmbed(
            "Vui lòng nhập mức âm lượng hợp lệ là một số nguyên từ `0` đến `200`!\nVí dụ: `!volume 80`"
          )
        ]
      });
      return;
    }

    player.setVolume(amount);

    await message.reply({
      embeds: [
        createSuccessEmbed(
          "🔊 ĐIỀU CHỈNH ÂM LƯỢNG",
          `Đã điều chỉnh âm lượng thành công: **${amount}%**`
        )
      ]
    });
  }
};
