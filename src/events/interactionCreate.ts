import {
  type Interaction,
  MessageFlags,
  type GuildMember
} from "discord.js";
import { EQ_PRESETS, type EqPresetKey } from "../ui/playerUi";

const importEsm = new Function("specifier", "return import(specifier)") as <T = any>(
  specifier: string
) => Promise<T>;

// Chặn spam nút bấm & menu: 5 giây / người
const INTERACTION_COOLDOWN_MS = 5000;
const interactionCooldowns = new Map<string, { until: number; warned: boolean }>();

// Tự dọn RAM mỗi 60 giây để tránh tràn bộ nhớ
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of interactionCooldowns.entries()) {
    if (now >= entry.until) {
      interactionCooldowns.delete(key);
    }
  }
}, 60_000).unref();

async function applyEqPreset(player: any, presetKey: EqPresetKey): Promise<void> {
  const preset = EQ_PRESETS[presetKey] || EQ_PRESETS.flat;
  const userdata = (player.userdata || {}) as Record<string, any>;
  player.userdata = { ...userdata, eqPreset: preset.key };

  try {
    // Điều chỉnh headroom âm lượng tức thì, không làm nghẽn CPU
    if (typeof player.setVolume === "function") {
      player.setVolume(preset.volume);
    }

    // Áp dụng dải tần EQ tương thích với phiên bản ZiPlayer
    if (typeof player.filters?.setEqualizer === "function") {
      await player.filters.setEqualizer(preset.bands);
    } else if (typeof player.filters?.setEQ === "function") {
      await player.filters.setEQ(preset.bands);
    } else if (typeof player.setEQ === "function") {
      await player.setEQ(preset.bands);
    }
  } catch {
    // Giữ nguyên luồng phát nếu plugin không hỗ trợ đổi filter giữa bài
  }
}

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  const guildId = interaction.guildId;
  if (!guildId || !interaction.guild) return;

  // Kiểm tra chặn spam 5s ngay trong RAM trước khi gọi Discord API (giảm lag)
  const cooldownKey = `${guildId}:${interaction.user.id}`;
  const now = Date.now();
  const activeCooldown = interactionCooldowns.get(cooldownKey);

  if (activeCooldown && now < activeCooldown.until) {
    if (!activeCooldown.warned) {
      activeCooldown.warned = true;
      const left = ((activeCooldown.until - now) / 1000).toFixed(1);
      await interaction
        .reply({
          content: `⏳ **Chống spam:** Vui lòng chờ **${left}s** trước khi bấm tiếp!`,
          flags: MessageFlags.Ephemeral
        })
        .catch(() => {});
    }
    return;
  }

  interactionCooldowns.set(cooldownKey, {
    until: now + INTERACTION_COOLDOWN_MS,
    warned: false
  });

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (deferError) {
    console.error("[Interaction Defer Error]", deferError);
    return;
  }

  const member = interaction.member as GuildMember | null;
  const userVoiceChannel = member?.voice?.channel;
  const botVoiceChannel = interaction.guild.members.me?.voice?.channel;

  if (!userVoiceChannel) {
    await interaction.editReply({
      content: "❌ Bạn cần tham gia vào một kênh thoại để sử dụng bảng điều khiển nhạc!"
    });
    return;
  }

  if (botVoiceChannel && userVoiceChannel.id !== botVoiceChannel.id) {
    await interaction.editReply({
      content: `❌ Bạn phải ở trong cùng kênh thoại (**${botVoiceChannel.name}**) với bot để sử dụng chức năng này!`
    });
    return;
  }

  const { getPlayer } = await importEsm<typeof import("ziplayer")>("ziplayer");
  const player = getPlayer(guildId);
  if (!player) {
    await interaction.editReply({
      content: "❌ Không tìm thấy trình phát nhạc nào đang hoạt động trong máy chủ này!"
    });
    return;
  }

  if (interaction.isButton()) {
    switch (interaction.customId) {
      case "volt_pause": {
        if (!player.currentTrack) {
          await interaction.editReply({ content: "❌ Không có bài hát nào đang phát để tạm dừng!" });
          return;
        }
        if (player.isPaused) {
          await interaction.editReply({ content: "⚠️ Trình phát nhạc đã ở trạng thái tạm dừng rồi!" });
          return;
        }
        await player.pause();
        await interaction.editReply({
          content: `⏸️ Đã tạm dừng bài hát: **${player.currentTrack.title}**`
        });
        break;
      }

      case "volt_resume": {
        if (!player.currentTrack) {
          await interaction.editReply({ content: "❌ Không có bài hát nào để tiếp tục phát!" });
          return;
        }
        if (!player.isPaused) {
          await interaction.editReply({ content: "⚠️ Nhạc đang phát bình thường, không bị tạm dừng!" });
          return;
        }
        await player.resume();
        await interaction.editReply({
          content: `▶️ Đã tiếp tục phát bài hát: **${player.currentTrack.title}**`
        });
        break;
      }

      case "volt_skip": {
        if (!player.currentTrack) {
          await interaction.editReply({ content: "❌ Không có bài hát nào để bỏ qua!" });
          return;
        }
        const currentTitle = player.currentTrack.title;
        await player.skip();
        await interaction.editReply({
          content: `⏭️ Đã bỏ qua bài hát: **${currentTitle}**`
        });
        break;
      }

      case "volt_stop": {
        await player.stop();
        player.destroy();
        await interaction.editReply({
          content: "⏹️ Đã dừng phát nhạc, làm sạch danh sách phát và rời khỏi kênh thoại."
        });
        break;
      }

      default:
        await interaction.editReply({ content: "⚠️ Nút bấm không xác định." });
        break;
    }
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "volt_control_menu") {
    const selected = interaction.values[0];

    if (selected && selected.startsWith("eq_")) {
      const key = selected.replace("eq_", "") as EqPresetKey;
      const preset = EQ_PRESETS[key] || EQ_PRESETS.flat;
      await applyEqPreset(player, preset.key);
      await interaction.editReply({
        content: `🎛️ Đã chuyển sang chế độ **${preset.label}** (${preset.description}).`
      });
      return;
    }

    switch (selected) {
      case "shuffle": {
        if (player.queue.size < 2) {
          await interaction.editReply({
            content: "❌ Cần ít nhất 2 bài hát trong hàng chờ để thực hiện xáo trộn!"
          });
          return;
        }
        player.queue.shuffle();
        await interaction.editReply({
          content: `🔀 Đã xáo trộn ngẫu nhiên **${player.queue.size}** bài hát trong danh sách chờ!`
        });
        break;
      }

      case "loop_track": {
        player.queue.loop("track");
        await interaction.editReply({
          content: "🔂 Đã kích hoạt chế độ: **Lặp lại 1 bài (Loop Track)**."
        });
        break;
      }

      case "loop_queue": {
        player.queue.loop("queue");
        await interaction.editReply({
          content: "🔁 Đã kích hoạt chế độ: **Lặp lại hàng chờ (Loop Queue)**."
        });
        break;
      }

      case "loop_off": {
        player.queue.loop("off");
        await interaction.editReply({
          content: "➡️ Đã **tắt** mọi chế độ lặp lại (Loop Off)."
        });
        break;
      }

      case "autoplay": {
        const userdata = (player.userdata || {}) as Record<string, any>;
        const currentAutoPlay =
          typeof userdata.autoPlay === "boolean"
            ? userdata.autoPlay
            : Boolean((player.queue as any).autoPlayEnabled);
        const nextState = !currentAutoPlay;
        player.queue.autoPlay(nextState);
        player.userdata = { ...userdata, autoPlay: nextState };
        await interaction.editReply({
          content: nextState
            ? "🎛️ Đã **BẬT** chế độ Tự động phát (AutoPlay)! Bot sẽ tự tìm bài tương tự khi hết nhạc."
            : "🎛️ Đã **TẮT** chế độ Tự động phát (AutoPlay)."
        });
        break;
      }

      default:
        await interaction.editReply({ content: "⚠️ Tùy chọn điều khiển không hợp lệ." });
        break;
    }
  }
}