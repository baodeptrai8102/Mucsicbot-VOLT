import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Message
} from "discord.js";
import type { Command } from "./types";
import { CONFIG } from "../config";
import { buildBotInviteUrl } from "../ui/playerUi";

export const helpCommand: Command = {
  name: "help",
  aliases: ["h"],
  description: "Hiển thị danh sách các lệnh nhạc tiền tố (!) của bot",
  usage: "!help",
  execute: async (message: Message): Promise<void> => {
    const inviteUrl = buildBotInviteUrl(message.client.user?.id);

    const embed = new EmbedBuilder()
      .setColor(CONFIG.EMBED_COLOR)
      .setTitle("⚡ VOLT MUSIC - DANH SÁCH LỆNH TIỀN TỐ (!)")
      .setDescription(
        "Bot hoạt động hoàn toàn bằng **tiền tố (`!`)**, tích hợp bộ chỉnh **EQ**, **chặn spam 5 giây** và tối ưu chống giật lag."
      )
      .addFields(
        {
          name: "🎵 `!play <tên bài/link>` (hoặc `!p`)",
          value: "Tìm kiếm và phát nhạc ngay lập tức từ YouTube, SoundCloud, Spotify hoặc file đính kèm."
        },
        {
          name: "⏸️ `!pause` • ▶️ `!resume` • ⏭️ `!skip` (`!s`) • ⏹️ `!stop`",
          value: "Tạm dừng, tiếp tục, bỏ qua bài hoặc dừng phát và rời kênh thoại."
        },
        {
          name: "📋 `!queue` (`!q`) • 🎧 `!nowplaying` (`!np`)",
          value: "Xem hàng chờ hoặc mở lại bảng điều khiển bài hát đang phát."
        },
        {
          name: "🔀 `!shuffle` • 🔁 `!loop <off|track|queue>` • 🎛️ `!autoplay`",
          value: "Xáo trộn hàng chờ, lặp lại 1 bài / cả hàng chờ hoặc bật tự động phát."
        },
        {
          name: "🔊 `!volume <0-200>` (hoặc `!vol`)",
          value: "Điều chỉnh mức âm lượng của bot."
        },
        {
          name: "✨ Bộ chỉnh EQ & Chống lag (Menu điều khiển)",
          value:
            "Chọn trực tiếp trong menu **`⚡ | Chọn chức năng điều khiển & chỉnh EQ...`** dưới khung nhạc: **Mặc định**, **Trong trẻo (Giảm đục)**, **Rõ giọng hát**, **Bass êm**.\n• **Chống spam:** Giới hạn thao tác cách nhau **5 giây/người**."
        }
      )
      .setFooter({
        text: "VOLT Music • Anti-Spam 5s • Low-CPU Smooth Mode",
        iconURL: message.client.user?.displayAvatarURL() || undefined
      })
      .setTimestamp();

    const inviteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Mời Music bot VOLT vào Server")
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl)
        .setEmoji("➕")
    );

    await message.reply({ embeds: [embed], components: [inviteRow] });
  }
};