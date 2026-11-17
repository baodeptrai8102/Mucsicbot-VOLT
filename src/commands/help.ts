import { EmbedBuilder, type Message } from "discord.js";
import type { Command } from "./types";
import { CONFIG } from "../config";

export const helpCommand: Command = {
  name: "help",
  aliases: ["h"],
  description: "Hiển thị danh sách các lệnh nhạc tiền tố (!) của bot",
  usage: "!help",
  execute: async (message: Message): Promise<void> => {
    const embed = new EmbedBuilder()
      .setColor(CONFIG.EMBED_COLOR)
      .setTitle("⚡ VOLT MUSIC - DANH SÁCH LỆNH TIỀN TỐ (!)")
      .setDescription(
        "Bot hoạt động hoàn toàn bằng **tiền tố (`!`)**, tối ưu hóa chống giật lag và chống timeout trên nền tảng Render 0.1 vCPU."
      )
      .addFields(
        {
          name: "🎵 `!play <tên bài/link>` (hoặc `!p`)",
          value: "Tìm kiếm và phát nhạc ngay lập tức từ YouTube, SoundCloud, Spotify hoặc file đính kèm."
        },
        {
          name: "⏸️ `!pause`",
          value: "Tạm dừng bài hát đang phát."
        },
        {
          name: "▶️ `!resume`",
          value: "Tiếp tục phát bài hát đang bị tạm dừng."
        },
        {
          name: "⏭️ `!skip` (hoặc `!s`)",
          value: "Bỏ qua bài hát hiện tại sang bài tiếp theo."
        },
        {
          name: "⏹️ `!stop`",
          value: "Dừng phát nhạc, dọn dẹp hàng chờ và rời khỏi kênh thoại."
        },
        {
          name: "📋 `!queue` (hoặc `!q`)",
          value: "Xem danh sách bài hát đang phát và hàng chờ."
        },
        {
          name: "🎧 `!nowplaying` (hoặc `!np`)",
          value: "Hiển thị thông tin chi tiết bài hát đang phát cùng thanh điều khiển tương tác."
        },
        {
          name: "🔀 `!shuffle`",
          value: "Xáo trộn ngẫu nhiên danh sách bài hát trong hàng chờ."
        },
        {
          name: "🔁 `!loop <off|track|queue>`",
          value: "Cài đặt chế độ lặp lại: `track` (1 bài), `queue` (cả hàng chờ), `off` (tắt)."
        },
        {
          name: "🎛️ `!autoplay`",
          value: "Bật hoặc tắt tính năng tự động tìm và phát bài tương tự khi hết danh sách."
        },
        {
          name: "🔊 `!volume <0-200>` (hoặc `!vol`)",
          value: "Điều chỉnh mức âm lượng của bot (mặc định: 80%)."
        },
        {
          name: "❓ `!help` (hoặc `!h`)",
          value: "Hiển thị bảng hướng dẫn này."
        }
      )
      .setFooter({
        text: "VOLT Music • Render 0.1 vCPU Optimized • Anti-Stutter Active",
        iconURL: message.client.user?.displayAvatarURL() || undefined
      })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
