import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from "discord.js";
import type { Track } from "ziplayer";
import { CONFIG } from "../config";

/**
 * Format milliseconds or duration value into MM:SS or HH:MM:SS format
 */
export function formatDuration(duration: number | string | undefined, isLive?: boolean): string {
  if (isLive || !duration) return "Live";
  if (typeof duration === "string") return duration;

  // Ziplayer track duration is in milliseconds
  const totalSeconds = Math.floor(duration > 10000000 ? duration / 1000 : duration / 1000);
  if (isNaN(totalSeconds) || totalSeconds <= 0) return "Live";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Extract clean user ID from requestedBy property (which can be a string ID or an object)
 */
export function extractRequestedById(requestedBy: any): string {
  if (!requestedBy) return "Unknown";
  if (typeof requestedBy === "string") return requestedBy;
  if (typeof requestedBy === "object") {
    return requestedBy.requestedBy || requestedBy.id || "Unknown";
  }
  return String(requestedBy);
}

/**
 * Creates the exact Now Playing Embed matching Section 4.A
 */
export function createNowPlayingEmbed(track: Track, botAvatarUrl?: string | null): EmbedBuilder {
  const formattedDuration = formatDuration(track.duration, track.isLive);
  const requestedById = extractRequestedById(track.requestedBy);
  const sourceName = (track.source || "YOUTUBE").toUpperCase();

  const embed = new EmbedBuilder()
    .setColor(CONFIG.EMBED_COLOR)
    .setTitle("⚡ VOLT MUSIC - ĐANG PHÁT")
    .setDescription(`🎶 **[${track.title}](${track.url})**`)
    .addFields(
      {
        name: "⏱️ Thời lượng",
        value: formattedDuration,
        inline: true
      },
      {
        name: "👤 Yêu cầu bởi",
        value: `<@${requestedById}>`,
        inline: true
      },
      {
        name: "🔊 Nguồn phát",
        value: sourceName,
        inline: true
      }
    )
    .setFooter({
      text: "VOLT Music • Render 0.1 vCPU Optimized • Anti-Stutter Active",
      iconURL: botAvatarUrl || undefined
    })
    .setTimestamp();

  if (track.thumbnail && track.thumbnail.startsWith("http")) {
    embed.setThumbnail(track.thumbnail);
  }

  return embed;
}

/**
 * Creates Action Row 1 - Playback Buttons matching Section 4.B
 */
export function createPlaybackButtonsRow(): ActionRowBuilder<ButtonBuilder> {
  const pauseButton = new ButtonBuilder()
    .setCustomId("volt_pause")
    .setLabel("Pause")
    .setEmoji("⏸️")
    .setStyle(ButtonStyle.Secondary);

  const resumeButton = new ButtonBuilder()
    .setCustomId("volt_resume")
    .setLabel("Resume")
    .setEmoji("▶️")
    .setStyle(ButtonStyle.Success);

  const skipButton = new ButtonBuilder()
    .setCustomId("volt_skip")
    .setLabel("Skip")
    .setEmoji("⏭️")
    .setStyle(ButtonStyle.Primary);

  const stopButton = new ButtonBuilder()
    .setCustomId("volt_stop")
    .setLabel("Stop")
    .setEmoji("⏹️")
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    pauseButton,
    resumeButton,
    skipButton,
    stopButton
  );
}

/**
 * Creates Action Row 2 - Control Dropdown matching Section 4.C
 */
export function createControlDropdownRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("volt_control_menu")
    .setPlaceholder("⚡ | Chọn chức năng điều khiển...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Trộn danh sách phát (Shuffle)")
        .setDescription("Xáo trộn ngẫu nhiên tất cả bài hát")
        .setValue("shuffle")
        .setEmoji("🔀"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Lặp lại 1 bài (Loop Track)")
        .setDescription("Lặp đi lặp lại duy nhất bài hát đang phát")
        .setValue("loop_track")
        .setEmoji("🔂"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Lặp lại hàng chờ (Loop Queue)")
        .setDescription("Lặp lại toàn bộ danh sách phát")
        .setValue("loop_queue")
        .setEmoji("🔁"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Tắt chế độ lặp lại (Loop Off)")
        .setDescription("Tắt mọi chế độ lặp lại")
        .setValue("loop_off")
        .setEmoji("➡️"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Bật/Tắt Tự động phát (AutoPlay)")
        .setDescription("Tự động tìm kiếm và phát bài tương tự")
        .setValue("autoplay")
        .setEmoji("🎛️")
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * Creates the exact Search Timeout Warning Embed
 */
export function createSearchTimeoutEmbed(timeoutSeconds: number = 45): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(CONFIG.WARNING_COLOR)
    .setTitle(`⚠️ Quá thời gian tìm kiếm (${timeoutSeconds} giây)!`)
    .setDescription(
      "YouTube có thể đang giới hạn lưu lượng mạng máy chủ, vui lòng thử lại hoặc dùng link trực tiếp."
    )
    .setFooter({ text: "VOLT Music • Timeout Protection" })
    .setTimestamp();
}

/**
 * Creates a standard Error Embed
 */
export function createErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(CONFIG.ERROR_COLOR)
    .setTitle("❌ Đã xảy ra lỗi")
    .setDescription(message)
    .setFooter({ text: "VOLT Music" })
    .setTimestamp();
}

/**
 * Creates a standard Info/Success Embed
 */
export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(CONFIG.EMBED_COLOR)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "VOLT Music" })
    .setTimestamp();
}
