import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { Player, Track } from "ziplayer";
import { config } from "../config.js";

/**
 * Định dạng thời gian từ mili-giây sang mm:ss hoặc hh:mm:ss
 */
export function formatDuration(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Tạo Embed giao diện phát nhạc chính Now Playing
 */
export function buildPlayerEmbed(player: Player, track?: Track | null): EmbedBuilder {
  const current = track || player.currentTrack;

  if (!current) {
    return new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle("🎵 VOLT Music Player")
      .setDescription("Hiện tại không có bài hát nào đang phát.")
      .setFooter({ text: `Dùng lệnh ${config.prefix}play <tên bài hát> để bắt đầu phát nhạc nhé Anh Bo! ✨` });
  }

  const time = player.getTime();
  const progressBar = player.getProgressBar() || "▬".repeat(15);
  const activeFilters = player.filter.getActiveFilters();
  const activeEq = activeFilters.length > 0 ? activeFilters.map((f) => f.description || f.name).join(", ") : "Tắt (Normal / Inline Opus)";
  const loopMode = player.queue.getLoopMode() || "off";

  const loopBadge = loopMode === "track" ? "🔂 Bật (Lặp 1 bài)" : loopMode === "queue" ? "🔁 Bật (Lặp danh sách)" : "❌ Tắt";
  const stateBadge = player.isPaused ? "⏸️ Đang tạm dừng" : "▶️ Đang phát";
  const safeVolume = Math.min(100, Math.max(0, typeof player.volume === "number" ? player.volume : 80));

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setAuthor({
      name: `Đang phát nhạc - VOLT Music (Prefix: ${config.prefix})`,
      iconURL: "https://cdn.discordapp.com/emojis/853635082594615316.webp?size=96&quality=lossless",
    })
    .setTitle(current.title.slice(0, 256))
    .setURL(current.url || "https://discord.com")
    .setDescription(
      `**Nghệ sĩ:** \`${current.author || "Không xác định"}\`\n` +
      `**Trạng thái:** ${stateBadge} | **Âm lượng:** \`${safeVolume}%\` (Mặc định: 80%)\n` +
      `**Bộ lọc EQ:** \`${activeEq}\` | **Lặp lại (Loop):** \`${loopBadge}\`\n\n` +
      `\`${time.formatted.current || "00:00"}\` ${progressBar} \`${formatDuration(current.duration)}\``
    )
    .addFields(
      {
        name: "📥 Yêu cầu bởi",
        value: current.requestedBy ? `<@${current.requestedBy}>` : "Hệ thống",
        inline: true,
      },
      {
        name: "📑 Hàng đợi",
        value: `\`${player.queue.size}\` bài hát còn lại`,
        inline: true,
      },
      {
        name: "🌐 Nguồn phát",
        value: `\`${current.source || "Web"}\``,
        inline: true,
      }
    )
    .setFooter({
      text: `VOLT Music • Dùng 4 nút bên dưới hoặc Menu Dropdown mở rộng 🦊🌸`,
    })
    .setTimestamp();

  if (current.thumbnail) {
    embed.setThumbnail(current.thumbnail);
  }

  return embed;
}

/**
 * Xây dựng giao diện điều khiển:
 * 1. Nút bấm trực tiếp: Pause, Resume, Skip, Stop
 * 2. Menu Dropdown: Queue, Bật/Tắt Loop, Âm lượng 100%, 6 chế độ EQ
 */
export function buildPlayerActionRows(player: Player): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const isPaused = player.isPaused;

  // Hàng 1: 4 nút bấm điều khiển trực tiếp
  const pauseButton = new ButtonBuilder()
    .setCustomId("player_pause")
    .setLabel("Tạm dừng")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("⏸️")
    .setDisabled(isPaused);

  const resumeButton = new ButtonBuilder()
    .setCustomId("player_resume")
    .setLabel("Tiếp tục")
    .setStyle(ButtonStyle.Success)
    .setEmoji("▶️")
    .setDisabled(!isPaused);

  const skipButton = new ButtonBuilder()
    .setCustomId("player_skip")
    .setLabel("Bỏ qua")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("⏭️");

  const stopButton = new ButtonBuilder()
    .setCustomId("player_stop")
    .setLabel("Dừng")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("⏹️");

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    pauseButton,
    resumeButton,
    skipButton,
    stopButton
  );

  // Hàng 2: Menu Dropdown (Queue, Bật/Tắt Loop, Âm lượng <= 100%, 6 chế độ EQ & Tắt EQ)
  const loopMode = player.queue.getLoopMode() || "off";
  const activeFilters = player.filter.getActiveFilters();
  const activeFilterName = activeFilters[0]?.name || "off";

  const dropdownMenu = new StringSelectMenuBuilder()
    .setCustomId("player_dropdown_menu")
    .setPlaceholder("🎛️ Bảng điều khiển (Queue, Loop, Âm lượng <=100%, EQ)...")
    .addOptions(
      // 1. Xem danh sách phát (Queue)
      new StringSelectMenuOptionBuilder()
        .setLabel("Xem danh sách phát (Queue)")
        .setValue("menu_queue")
        .setDescription("Hiển thị danh sách các bài hát trong hàng đợi")
        .setEmoji("📜"),

      // 2. Bật/Tắt Lặp lại bài hát (Loop)
      new StringSelectMenuOptionBuilder()
        .setLabel(loopMode === "track" ? "Tắt lặp lại bài hát (Loop: Off)" : "Bật lặp lại bài hát (Loop: Track)")
        .setValue("menu_loop")
        .setDescription(loopMode === "track" ? "Đang bật lặp lại -> Nhấn để TẮT" : "Đang tắt lặp lại -> Nhấn để BẬT")
        .setEmoji("🔂"),

      // 3. Âm lượng chuẩn (Khóa trần tối đa 100% chống rè/vỡ tiếng, mặc định 80%)
      new StringSelectMenuOptionBuilder()
        .setLabel("Âm lượng: 100% (Tối đa trần - Chống rè)")
        .setValue("menu_vol_100")
        .setDescription("Khóa trần 100%, không vượt quá để tránh vỡ tiếng")
        .setEmoji("🔊"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Âm lượng: 80% (Mặc định chuẩn - Khuyên dùng)")
        .setValue("menu_vol_80")
        .setDescription("Mức âm lượng tối ưu trong trẻo, không bị méo tiếng")
        .setEmoji("🔉"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Âm lượng: 60% (Vừa vặn)")
        .setValue("menu_vol_60")
        .setDescription("Thiết lập âm lượng 60% vừa phải")
        .setEmoji("🔉"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Âm lượng: 40% (Êm dịu)")
        .setValue("menu_vol_40")
        .setDescription("Thiết lập âm lượng 40% êm ái")
        .setEmoji("🔈"),

      // 4. Các chế độ EQ (Mặc định TẮT toàn bộ để phát inline Opus nguyên bản không qua FFmpeg)
      new StringSelectMenuOptionBuilder()
        .setLabel("Tắt EQ (Normal / Flat)")
        .setValue("eq_off")
        .setDescription("Mặc định: Âm thanh gốc inline Opus trong trẻo, không qua FFmpeg")
        .setEmoji("⚪")
        .setDefault(activeFilterName === "off"),
      new StringSelectMenuOptionBuilder()
        .setLabel("EQ: Bass Boost")
        .setValue("eq_bassboost")
        .setDescription("Tăng cường dải âm trầm mạnh mẽ bùng nổ")
        .setEmoji("🔊")
        .setDefault(activeFilterName === "bassboost"),
      new StringSelectMenuOptionBuilder()
        .setLabel("EQ: Nightcore")
        .setValue("eq_nightcore")
        .setDescription("Tăng tốc độ và cao độ sôi động vui tươi")
        .setEmoji("⚡")
        .setDefault(activeFilterName === "nightcore"),
      new StringSelectMenuOptionBuilder()
        .setLabel("EQ: Vaporwave")
        .setValue("eq_vaporwave")
        .setDescription("Giảm nhịp điệu phong cách chill hoài niệm")
        .setEmoji("🌊")
        .setDefault(activeFilterName === "vaporwave"),
      new StringSelectMenuOptionBuilder()
        .setLabel("EQ: Crystal Clear")
        .setValue("eq_crystal")
        .setDescription("Dải cao trong trẻo, sắc nét chi tiết dải treble")
        .setEmoji("💎")
        .setDefault(activeFilterName === "crystal"),
      new StringSelectMenuOptionBuilder()
        .setLabel("EQ: Lo-Fi")
        .setValue("eq_lofi")
        .setDescription("Âm thanh mộc mạc hoài niệm, thư giãn dịu nhẹ")
        .setEmoji("☕")
        .setDefault(activeFilterName === "lofi"),
      new StringSelectMenuOptionBuilder()
        .setLabel("EQ: Karaoke")
        .setValue("eq_karaoke")
        .setDescription("Lọc dải tần vocal ca sĩ để hát theo bài hát")
        .setEmoji("🎤")
        .setDefault(activeFilterName === "karaoke")
    );

  const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(dropdownMenu);

  return [buttonRow, menuRow];
}

/**
 * Xây dựng Embed danh sách hàng đợi (Queue)
 */
export function buildQueueEmbed(player: Player): EmbedBuilder {
  const current = player.currentTrack;
  const tracks = player.queue.tracksList || [];
  const loopMode = player.queue.getLoopMode() || "off";
  const loopBadge = loopMode === "track" ? "🔂 Lặp 1 bài" : loopMode === "queue" ? "🔁 Lặp danh sách" : "❌ Tắt";
  const safeVolume = Math.min(100, Math.max(0, typeof player.volume === "number" ? player.volume : 80));

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle("📜 Danh Sách Hàng Đợi - VOLT Music")
    .setFooter({
      text: `Tổng số: ${tracks.length + (current ? 1 : 0)} bài • Lặp lại: ${loopBadge} • Âm lượng: ${safeVolume}% 🦊`,
    })
    .setTimestamp();

  if (current) {
    embed.addFields({
      name: "▶️ Đang phát:",
      value: `[${current.title}](${current.url}) | \`${formatDuration(current.duration)}\` (Yêu cầu: <@${current.requestedBy}>)`,
    });
  }

  if (tracks.length === 0) {
    embed.setDescription(`Hàng đợi hiện tại đang trống. Hãy thêm bài hát mới bằng lệnh \`${config.prefix}play <tên bài>\` nhé Anh Bo!`);
  } else {
    const listLimit = 10;
    const displayedTracks = tracks.slice(0, listLimit);
    const trackLines = displayedTracks.map((t, idx) => {
      return `\`${idx + 1}.\` [${t.title}](${t.url}) - \`${formatDuration(t.duration)}\` | <@${t.requestedBy}>`;
    });

    if (tracks.length > listLimit) {
      trackLines.push(`*...và còn ${tracks.length - listLimit} bài hát nữa*`);
    }

    embed.setDescription(trackLines.join("\n"));
  }

  return embed;
}
