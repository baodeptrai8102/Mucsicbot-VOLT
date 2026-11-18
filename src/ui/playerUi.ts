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

export type EqPresetKey = "flat" | "clear" | "vocal" | "softbass";

export interface EqPresetConfig {
  key: EqPresetKey;
  label: string;
  shortName: string;
  description: string;
  volume: number;
  bands: { band: number; gain: number }[];
}

// Bộ EQ 3 dải tần tối ưu CPU thấp, khắc phục tiếng đục/hỗn tạp trên nhạc remix
export const EQ_PRESETS: Record<EqPresetKey, EqPresetConfig> = {
  flat: {
    key: "flat",
    label: "EQ: Mặc định (Normal)",
    shortName: "Mặc định",
    description: "Âm thanh nguyên bản, tiết kiệm CPU tối đa",
    volume: 100,
    bands: []
  },
  clear: {
    key: "clear",
    label: "EQ: Trong trẻo (Clear - Giảm đục)",
    shortName: "Trong trẻo",
    description: "Giảm bass ù/đục, tách bạch giọng hát và nhạc nền",
    volume: 92,
    bands: [
      { band: 1, gain: -0.15 },
      { band: 2, gain: -0.12 },
      { band: 10, gain: 0.1 }
    ]
  },
  vocal: {
    key: "vocal",
    label: "EQ: Rõ giọng hát (Vocal)",
    shortName: "Rõ giọng hát",
    description: "Đẩy nhẹ dải trung giúp lời bài hát nổi rõ",
    volume: 95,
    bands: [
      { band: 0, gain: -0.08 },
      { band: 6, gain: 0.12 },
      { band: 8, gain: 0.12 }
    ]
  },
  softbass: {
    key: "softbass",
    label: "EQ: Bass êm (Chống vỡ tiếng)",
    shortName: "Bass êm",
    description: "Tăng nhẹ âm trầm gọn gàng, hạn chế rè loa",
    volume: 90,
    bands: [
      { band: 0, gain: 0.12 },
      { band: 1, gain: 0.08 },
      { band: 3, gain: -0.08 }
    ]
  }
};

export function buildBotInviteUrl(clientId?: string): string {
  const id = clientId || process.env.CLIENT_ID || "1571494188527124510";
  return `https://discord.com/oauth2/authorize?client_id=${id}&permissions=3147776&scope=bot%20applications.commands`;
}

/**
 * Format milliseconds or duration value into MM:SS or HH:MM:SS format
 */
export function formatDuration(duration: number | string | undefined, isLive?: boolean): string {
  if (isLive || !duration) return "Live";
  if (typeof duration === "string") return duration;

  const totalSeconds = Math.floor(duration / 1000);
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
 * Extract clean user ID from requestedBy property
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
 * Creates the Now Playing Embed
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
      text: "VOLT Music • Anti-Spam 5s • Low-CPU Smooth Mode",
      iconURL: botAvatarUrl || undefined
    })
    .setTimestamp();

  if (track.thumbnail && track.thumbnail.startsWith("http")) {
    embed.setThumbnail(track.thumbnail);
  }

  return embed;
}

/**
 * Creates Action Row 1 - Playback Buttons
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
 * Creates Action Row 2 - Control & EQ Dropdown
 */
export function createControlDropdownRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("volt_control_menu")
    .setPlaceholder("⚡ | Chọn chức năng điều khiển & chỉnh EQ...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(EQ_PRESETS.flat.label)
        .setDescription(EQ_PRESETS.flat.description)
        .setValue("eq_flat")
        .setEmoji("🎵"),
      new StringSelectMenuOptionBuilder()
        .setLabel(EQ_PRESETS.clear.label)
        .setDescription(EQ_PRESETS.clear.description)
        .setValue("eq_clear")
        .setEmoji("✨"),
      new StringSelectMenuOptionBuilder()
        .setLabel(EQ_PRESETS.vocal.label)
        .setDescription(EQ_PRESETS.vocal.description)
        .setValue("eq_vocal")
        .setEmoji("🎤"),
      new StringSelectMenuOptionBuilder()
        .setLabel(EQ_PRESETS.softbass.label)
        .setDescription(EQ_PRESETS.softbass.description)
        .setValue("eq_softbass")
        .setEmoji("🔊"),
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
 * Creates the Search Timeout Warning Embed
 */
export function createSearchTimeoutEmbed(timeoutSeconds: number = 45): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(CONFIG.WARNING_COLOR)
    .setTitle(`⚠️ Quá thời gian tìm kiếm (${timeoutSeconds} giây)!`)
    .setDescription(
      "Máy chủ nguồn phản hồi chậm, vui lòng thử lại hoặc nhập tên bài hát ngắn gọn."
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