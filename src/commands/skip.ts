import { type Message } from "discord.js";
import { getPlayer } from "ziplayer";
import type { Command } from "./types";
import { createErrorEmbed, createSuccessEmbed } from "../ui/playerUi";

export const skipCommand: Command = {
  name: "skip",
  aliases: ["s"],
  description: "Bỏ qua bài hát đang phát sang bài kế tiếp",
  usage: "!skip",
  execute: async (message: Message): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply({
        embeds: [createErrorEmbed("Bạn cần tham gia kênh thoại của bot để chuyển bài!")]
      });
      return;
    }

    const player = getPlayer(guildId);
    if (!player || !player.currentTrack) {
      await message.reply({
        embeds: [createErrorEmbed("Hiện không có bài hát nào đang phát để bỏ qua!")]
      });
      return;
    }

    const skippedTrack = player.currentTrack;
    await player.skip();

    await message.reply({
      embeds: [
        createSuccessEmbed(
          "⏭️ BỎ QUA",
          `Đã bỏ qua bài hát: **[${skippedTrack.title}](${skippedTrack.url})**`
        )
      ]
    });
  }
};
