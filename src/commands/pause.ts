import { type Message } from "discord.js";
import { getPlayer } from "ziplayer";
import type { Command } from "./types";
import { createErrorEmbed, createSuccessEmbed } from "../ui/playerUi";

export const pauseCommand: Command = {
  name: "pause",
  description: "Tạm dừng phát bài hát hiện tại",
  usage: "!pause",
  execute: async (message: Message): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply({
        embeds: [createErrorEmbed("Bạn cần tham gia kênh thoại của bot để tạm dừng nhạc!")]
      });
      return;
    }

    const player = getPlayer(guildId);
    if (!player || !player.currentTrack) {
      await message.reply({
        embeds: [createErrorEmbed("Hiện không có bài hát nào đang phát trong máy chủ này!")]
      });
      return;
    }

    if (player.isPaused) {
      await message.reply({
        embeds: [createErrorEmbed("Trình phát nhạc đã ở trạng thái tạm dừng rồi!")]
      });
      return;
    }

    await player.pause();
    await message.reply({
      embeds: [
        createSuccessEmbed(
          "⏸️ TẠM DỪNG",
          `Đã tạm dừng bài hát **[${player.currentTrack.title}](${player.currentTrack.url})**.`
        )
      ]
    });
  }
};
