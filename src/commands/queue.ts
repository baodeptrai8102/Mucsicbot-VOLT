import { EmbedBuilder, type Message } from "discord.js";
import { getPlayer } from "ziplayer";
import type { Command } from "./types";
import { CONFIG } from "../config";
import { createErrorEmbed, formatDuration } from "../ui/playerUi";

export const queueCommand: Command = {
  name: "queue",
  aliases: ["q"],
  description: "Xem danh sách bài hát đang phát và hàng chờ",
  usage: "!queue",
  execute: async (message: Message): Promise<void> => {
    const guildId = message.guildId;
    if (!guildId) return;

    const player = getPlayer(guildId);
    if (!player || (!player.currentTrack && player.queue.isEmpty)) {
      await message.reply({
        embeds: [createErrorEmbed("Hàng chờ hiện tại đang trống rỗng!")]
      });
      return;
    }

    const currentTrack = player.currentTrack;
    const upcomingTracks = player.queue.getTracks();
    const loopMode = player.queue.getLoopMode();
    const autoPlay = (player.queue as any).autoPlayEnabled ?? false;

    const embed = new EmbedBuilder()
      .setColor(CONFIG.EMBED_COLOR)
      .setTitle("📋 DANH SÁCH HÀNG CHỜ PHÁT NHẠC");

    let description = "";

    if (currentTrack) {
      description += `▶️ **Đang phát:** [${currentTrack.title}](${currentTrack.url}) \`[${formatDuration(currentTrack.duration, currentTrack.isLive)}]\`\n\n`;
    }

    if (upcomingTracks.length > 0) {
      description += `**Bài hát kế tiếp (${upcomingTracks.length} bài):**\n`;
      const displayedTracks = upcomingTracks.slice(0, 10);
      displayedTracks.forEach((track, index) => {
        description += `**${index + 1}.** [${track.title}](${track.url}) \`[${formatDuration(track.duration, track.isLive)}]\`\n`;
      });

      if (upcomingTracks.length > 10) {
        description += `\n*...và còn ${upcomingTracks.length - 10} bài hát khác trong hàng chờ.*`;
      }
    } else {
      description += "*Hàng chờ trống. Không có bài hát kế tiếp nào.*";
    }

    embed.setDescription(description);
    embed.addFields(
      {
        name: "🔁 Lặp lại",
        value: `\`${loopMode.toUpperCase()}\``,
        inline: true
      },
      {
        name: "🎛️ AutoPlay",
        value: `\`${autoPlay ? "BẬT" : "TẮT"}\``,
        inline: true
      },
      {
        name: "🔊 Âm lượng",
        value: `\`${player.volume}%\``,
        inline: true
      }
    );

    embed.setFooter({
      text: `Tổng số bài: ${upcomingTracks.length + (currentTrack ? 1 : 0)} • VOLT Music`
    });
    embed.setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
