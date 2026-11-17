import { EmbedBuilder, type Message } from "discord.js";
import { getManager, getPlayer } from "ziplayer";
import type { Command } from "./types";
import { CONFIG } from "../config";
import { createErrorEmbed, createSearchTimeoutEmbed } from "../ui/playerUi";

export const playCommand: Command = {
  name: "play",
  aliases: ["p"],
  description: "Phát bài hát từ YouTube, SoundCloud, Spotify hoặc link âm thanh",
  usage: "!play <tên bài hát / link>",
  execute: async (message: Message, args: string[]): Promise<void> => {
    // ANTI-TIMEOUT (10062 PROTECTION): Send loading reply IMMEDIATELY on first line
    const loadingMsg = await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(CONFIG.EMBED_COLOR)
          .setDescription("⚡ **Đang chuẩn bị kết nối và tìm kiếm bài hát...**")
      ]
    });

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed("Bạn cần tham gia một kênh thoại trước khi dùng lệnh phát nhạc!")]
      });
      return;
    }

    const query = args.join(" ").trim();
    if (!query) {
      await loadingMsg.edit({
        embeds: [
          createErrorEmbed(
            "Vui lòng cung cấp tên bài hát hoặc đường link hợp lệ!\nVí dụ: `!play Đi Về Nhà` hoặc `!play <URL>`"
          )
        ]
      });
      return;
    }

    const guildId = message.guildId;
    if (!guildId) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed("Lệnh này chỉ có thể sử dụng trong máy chủ Discord!")]
      });
      return;
    }

    const manager = getManager();
    if (!manager) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed("Hệ thống âm thanh ZiPlayer chưa được khởi tạo!")]
      });
      return;
    }

    let player = getPlayer(guildId);
    if (!player) {
      player = await manager.create(guildId, {
        leaveOnEnd: true,
        leaveOnEmpty: true,
        volume: CONFIG.DEFAULT_VOLUME,
        antiStuck: {
          enabled: true,
          maxRetries: 0,
          controlledSkipThreshold: 1
        },
        userdata: { channel: message.channel }
      });
    } else {
      player.userdata = { ...(player.userdata || {}), channel: message.channel };
    }

    // Connect to voice channel immediately if not connected or not ready
    const isConnectionReady =
      player.connection &&
      (player.connection.state as any)?.status === "ready";

    if (!isConnectionReady) {
      try {
        await player.connect(voiceChannel as any);
      } catch (connError: any) {
        if (!connError?.message?.includes("aborted")) {
          console.error("[Voice Connection Error]:", connError);
          await loadingMsg.edit({
            embeds: [
              createErrorEmbed(
                `Không thể kết nối vào kênh thoại: ${connError?.message || "Kiểm tra quyền truy cập của bot!"}`
              )
            ]
          });
          return;
        }
      }
    }

    // FAST PLAYBACK & TIMEOUT PROTECTION: Wrap player.play in Promise.race
    const requestedById = message.author.id;
    const playPromise = player.play(query, requestedById);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SEARCH_TIMEOUT")), CONFIG.SEARCH_TIMEOUT_MS)
    );

    try {
      const result = await Promise.race([playPromise, timeoutPromise]);

      if (!result) {
        await loadingMsg.edit({
          embeds: [
            createErrorEmbed(
              "Không tìm thấy kết quả hoặc không thể nạp bài hát. Vui lòng thử từ khóa khác hoặc dùng link trực tiếp!"
            )
          ]
        });
        return;
      }

      await loadingMsg.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(CONFIG.EMBED_COLOR)
            .setTitle("⚡ VOLT MUSIC - ĐÃ TIẾP NHẬN")
            .setDescription(
              `🎶 Đã nạp yêu cầu: **${query}**\nBài hát sẽ bắt đầu phát hoặc được tự động xếp vào danh sách phát!`
            )
            .setFooter({ text: "VOLT Music • 0.1 vCPU Optimized" })
            .setTimestamp()
        ]
      });
    } catch (err: any) {
      if (err?.message === "SEARCH_TIMEOUT" || String(err).toLowerCase().includes("timeout")) {
        await loadingMsg.edit({
          embeds: [createSearchTimeoutEmbed(CONFIG.SEARCH_TIMEOUT_MS / 1000)]
        });
      } else {
        console.error("[Play Execution Error]:", err);
        await loadingMsg.edit({
          embeds: [
            createErrorEmbed(
              `Đã xảy ra sự cố khi tải bài hát: ${err?.message || "Vui lòng thử lại sau hoặc dùng link trực tiếp!"}`
            )
          ]
        });
      }
    }
  }
};
