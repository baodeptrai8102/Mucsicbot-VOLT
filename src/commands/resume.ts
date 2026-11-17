import { type Message } from "discord.js";
import { getPlayer } from "ziplayer";
import type { Command } from "./types";
import { createErrorEmbed, createSuccessEmbed } from "../ui/playerUi";

export const resumeCommand: Command = {
  name: "resume",
  description: "Tiếp tục phát bài hát đang tạm dừng",
  usage: "!resume",
  execute: async (message: Message): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply({
        embeds: [createErrorEmbed("Bạn cần tham gia kênh thoại của bot để tiếp tục phát nhạc!")]
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

    if (!player.isPaused) {
      await message.reply({
        embeds: [createErrorEmbed("Trình phát nhạc đang phát bình thường, không bị tạm dừng!")]
      });
      return;
    }

    await player.resume();
    await message.reply({
      embeds: [
        createSuccessEmbed(
          "▶️ TIẾP TỤC",
          `Đã tiếp tục phát bài hát **[${player.currentTrack.title}](${player.currentTrack.url})**.`
        )
      ]
    });
  }
};
