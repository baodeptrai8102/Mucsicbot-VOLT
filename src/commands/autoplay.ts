import { type Message } from "discord.js";
import { getPlayer } from "ziplayer";
import type { Command } from "./types";
import { createErrorEmbed, createSuccessEmbed } from "../ui/playerUi";

export const autoplayCommand: Command = {
  name: "autoplay",
  description: "Bật hoặc tắt chế độ tự động phát các bài hát tương tự khi hết hàng chờ",
  usage: "!autoplay",
  execute: async (message: Message): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply({
        embeds: [createErrorEmbed("Bạn cần tham gia kênh thoại của bot để chỉnh AutoPlay!")]
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

    const currentAutoPlay = (player.queue as any).autoPlayEnabled ?? false;
    const nextState = !currentAutoPlay;
    player.queue.autoPlay(nextState);

    await message.reply({
      embeds: [
        createSuccessEmbed(
          "🎛️ TỰ ĐỘNG PHÁT (AUTOPLAY)",
          nextState
            ? "Đã **BẬT** tính năng Tự động phát! Bot sẽ tự tìm và phát bài tương tự khi hết nhạc."
            : "Đã **TẮT** tính năng Tự động phát."
        )
      ]
    });
  }
};
