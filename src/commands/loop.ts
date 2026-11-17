import { type Message } from "discord.js";
import { getPlayer, type LoopMode } from "ziplayer";
import type { Command } from "./types";
import { createErrorEmbed, createSuccessEmbed } from "../ui/playerUi";

export const loopCommand: Command = {
  name: "loop",
  description: "Cài đặt chế độ lặp lại bài hát hoặc hàng chờ",
  usage: "!loop <off|track|queue>",
  execute: async (message: Message, args: string[]): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply({
        embeds: [createErrorEmbed("Bạn cần tham gia kênh thoại của bot để chỉnh lặp lại!")]
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

    const rawMode = args[0]?.toLowerCase();
    if (!rawMode || !["off", "track", "queue"].includes(rawMode)) {
      const currentMode = player.queue.getLoopMode();
      await message.reply({
        embeds: [
          createErrorEmbed(
            `Chế độ lặp lại hiện tại: \`${currentMode.toUpperCase()}\`\nCách dùng: \`!loop <off | track | queue>\``
          )
        ]
      });
      return;
    }

    const mode = rawMode as LoopMode;
    player.queue.loop(mode);

    const modeLabels: Record<LoopMode, string> = {
      off: "➡️ Tắt chế độ lặp lại",
      track: "🔂 Lặp lại 1 bài hát đang phát",
      queue: "🔁 Lặp lại toàn bộ danh sách phát (Queue)"
    };

    await message.reply({
      embeds: [
        createSuccessEmbed("CHẾ ĐỘ LẶP LẠI", `Đã thiết lập: **${modeLabels[mode]}**`)
      ]
    });
  }
};
