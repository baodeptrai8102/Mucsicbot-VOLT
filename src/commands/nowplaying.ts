import { type Message } from "discord.js";
import { getPlayer } from "ziplayer";
import type { Command } from "./types";
import {
  createErrorEmbed,
  createNowPlayingEmbed,
  createPlaybackButtonsRow,
  createControlDropdownRow
} from "../ui/playerUi";

export const nowPlayingCommand: Command = {
  name: "nowplaying",
  aliases: ["np"],
  description: "Xem chi tiết bài hát đang phát cùng bảng điều khiển",
  usage: "!nowplaying",
  execute: async (message: Message): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const player = getPlayer(guildId);
    if (!player || !player.currentTrack) {
      await message.reply({
        embeds: [createErrorEmbed("Hiện không có bài hát nào đang phát!")]
      });
      return;
    }

    const embed = createNowPlayingEmbed(
      player.currentTrack,
      message.client.user?.displayAvatarURL()
    );
    const row1 = createPlaybackButtonsRow();
    const row2 = createControlDropdownRow();

    await message.reply({
      embeds: [embed],
      components: [row1, row2]
    });
  }
};
