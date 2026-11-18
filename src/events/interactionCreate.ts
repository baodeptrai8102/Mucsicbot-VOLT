import {
  Events,
  GuildMember,
  Interaction,
  MessageFlags,
} from "discord.js";
import { getPlayer } from "ziplayer";
import { checkCooldown } from "../config.js";
import {
  buildPlayerActionRows,
  buildPlayerEmbed,
  buildQueueEmbed,
} from "../ui/playerUi.js";

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const member = interaction.member as GuildMember;
  const voiceChannel = member?.voice?.channel;

  // 1. Xử lý 4 Nút bấm điều khiển trực tiếp: Pause, Resume, Skip, Stop
  if (interaction.isButton()) {
    // Chống spam bấm nút 2 giây
    const cooldown = checkCooldown(interaction.user.id, `btn_${interaction.customId}`, 2000);
    if (cooldown.onCooldown) {
      await interaction.reply({
        content: `⏳ Anh Bo thao tác nhanh quá nè! Vui lòng đợi **${cooldown.remainingSeconds} giây** nhé 🦊`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    const player = getPlayer(guildId);
    if (!player) {
      await interaction.reply({
        content: "❌ Không tìm thấy trình phát nhạc nào đang hoạt động trong máy chủ!",
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    // Khóa trần âm lượng tối đa 100 chống rè/vỡ tiếng
    if (player.volume > 100) {
      player.setVolume(100);
    }

    // Kiểm tra người dùng có đang ở trong kênh thoại không
    if (!voiceChannel) {
      await interaction.reply({
        content: "⚠️ Anh Bo cần tham gia vào kênh thoại để điều khiển nhạc nha! 🌸",
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    const customId = interaction.customId;

    try {
      switch (customId) {
        case "player_pause": {
          if (player.isPaused) {
            await interaction.reply({
              content: "⚠️ Bài hát hiện tại vốn đã tạm dừng rồi!",
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
            return;
          }

          // Acknowledge interaction ngay lập tức để tránh lỗi Unknown interaction (10062)
          await interaction.deferUpdate().catch(() => {});
          player.pause();

          await interaction.editReply({
            embeds: [buildPlayerEmbed(player)],
            components: buildPlayerActionRows(player),
          }).catch(() => {});

          await interaction.followUp({
            content: "⏸️ Đã tạm dừng bài hát hiện tại. 🦊",
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
          break;
        }

        case "player_resume": {
          if (!player.isPaused) {
            await interaction.reply({
              content: "⚠️ Bài hát đang phát bình thường, không bị tạm dừng!",
              flags: MessageFlags.Ephemeral,
            }).catch(() => {});
            return;
          }

          await interaction.deferUpdate().catch(() => {});
          player.resume();

          await interaction.editReply({
            embeds: [buildPlayerEmbed(player)],
            components: buildPlayerActionRows(player),
          }).catch(() => {});

          await interaction.followUp({
            content: "▶️ Đã tiếp tục phát nhạc rồi nhé Anh Bo! ✨",
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
          break;
        }

        case "player_skip": {
          const currentTrack = player.currentTrack;
          await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

          const skipped = await player.skip();
          if (skipped) {
            await interaction.editReply({
              content: `⏭️ Đã bỏ qua bài hát: **${currentTrack?.title || "Không rõ"}**! 🌸`,
            }).catch(() => {});
          } else {
            await interaction.editReply({
              content: "⚠️ Không thể bỏ qua bài hát hoặc danh sách phát đã hết!",
            }).catch(() => {});
          }
          break;
        }

        case "player_stop": {
          await interaction.deferUpdate().catch(() => {});

          player.stop();
          player.queue.clear();
          await player.disconnect().catch(() => {});

          await interaction.editReply({
            content: "⏹️ **Đã dừng phát nhạc, dọn dẹp hàng đợi và rời khỏi kênh thoại.** Hẹn gặp lại Anh Bo OniChan! 🌸🦊",
            embeds: [],
            components: [],
          }).catch(() => {});
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error("[InteractionCreate] Lỗi khi xử lý nút bấm:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Đã xảy ra sự cố khi điều khiển nút bấm!",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
    return;
  }

  // 2. Xử lý Menu Dropdown đa năng: Queue, Bật/Tắt Loop, Âm lượng 100%, 6 chế độ EQ
  if (interaction.isStringSelectMenu() && interaction.customId === "player_dropdown_menu") {
    const cooldown = checkCooldown(interaction.user.id, "select_dropdown", 1500);
    if (cooldown.onCooldown) {
      await interaction.reply({
        content: `⏳ Anh Bo vui lòng đợi **${cooldown.remainingSeconds} giây** trước khi thao tác tiếp nha 🌸`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    const player = getPlayer(guildId);
    if (!player) {
      await interaction.reply({
        content: "❌ Trình phát nhạc không còn tồn tại!",
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    // Khóa trần âm lượng tối đa 100 chống rè/vỡ tiếng
    if (player.volume > 100) {
      player.setVolume(100);
    }

    const selectedValue = interaction.values[0];

    try {
      // 2.1 Xem danh sách phát (Queue)
      if (selectedValue === "menu_queue") {
        const queueEmbed = buildQueueEmbed(player);
        await interaction.reply({
          embeds: [queueEmbed],
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return;
      }

      // Các tác vụ cập nhật giao diện (Loop, Volume, EQ) đều deferUpdate ngay lập tức để tránh lỗi timeout 3 giây
      await interaction.deferUpdate().catch(() => {});

      // 2.2 Bật/Tắt lặp lại bài hát (Loop)
      if (selectedValue === "menu_loop") {
        const currentMode = player.queue.getLoopMode() || "off";
        const newMode = currentMode === "off" ? "track" : "off";
        player.loop(newMode);

        await interaction.editReply({
          embeds: [buildPlayerEmbed(player)],
          components: buildPlayerActionRows(player),
        }).catch(() => {});

        const statusMsg = newMode === "track"
          ? "🔂 Đã **BẬT** chế độ lặp lại bài hát hiện tại! (Loop: Track)"
          : "❌ Đã **TẮT** chế độ lặp lại bài hát! (Loop: Off)";

        await interaction.followUp({
          content: `${statusMsg} 🌸✨`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return;
      }

      // 2.3 Chỉnh âm lượng chuẩn (Khóa trần tối đa 100, chống rè vỡ tiếng)
      if (selectedValue.startsWith("menu_vol_")) {
        const rawVol = parseInt(selectedValue.replace("menu_vol_", ""), 10);
        const volLevel = Math.max(0, Math.min(100, isNaN(rawVol) ? 80 : rawVol));
        player.setVolume(volLevel);

        await interaction.editReply({
          embeds: [buildPlayerEmbed(player)],
          components: buildPlayerActionRows(player),
        }).catch(() => {});

        await interaction.followUp({
          content: `🔊 Đã điều chỉnh âm lượng về mức chuẩn: **${volLevel}%** (đã khóa trần tối đa 100% chống rè/vỡ tiếng)! 🎶`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return;
      }

      // 2.4 Chế độ EQ & Tắt EQ (Mặc định tắt toàn bộ để phát inline Opus không qua FFmpeg)
      if (selectedValue.startsWith("eq_")) {
        const filterName = selectedValue.replace("eq_", "").toLowerCase();

        if (filterName === "off" || filterName === "normal" || filterName === "flat") {
          // Tắt toàn bộ filter/EQ, dọn dẹp FFmpeg để phát inline Opus nguyên bản
          await player.filter.clearAll();

          await interaction.editReply({
            embeds: [buildPlayerEmbed(player)],
            components: buildPlayerActionRows(player),
          }).catch(() => {});

          await interaction.followUp({
            content: "⚪ **Đã tắt toàn bộ bộ lọc EQ!** Trình phát đã quay lại chế độ âm thanh gốc **Inline Opus** sạch sẽ, trong trẻo và không qua FFmpeg. ✨🌸",
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
          return;
        }

        // Kích hoạt bộ lọc FFmpeg cụ thể theo lựa chọn của người dùng
        await player.filter.clearAll();
        const applied = await player.filter.applyFilter(filterName);

        await interaction.editReply({
          embeds: [buildPlayerEmbed(player)],
          components: buildPlayerActionRows(player),
        }).catch(() => {});

        if (applied) {
          await interaction.followUp({
            content: `🎛️ Đã kích hoạt bộ lọc FFmpeg EQ: **${filterName.toUpperCase()}** thành công! 🎶🦊`,
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
        } else {
          await interaction.followUp({
            content: `⚠️ Không thể kích hoạt bộ lọc EQ **${filterName}**, tiếp tục phát âm thanh nguyên bản.`,
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
        }
        return;
      }
    } catch (menuError) {
      console.error("[InteractionCreate] Lỗi khi xử lý Menu Dropdown:", menuError);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "⚠️ Đã xảy ra lỗi khi thực thi lựa chọn trong Menu!",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
  }
}
