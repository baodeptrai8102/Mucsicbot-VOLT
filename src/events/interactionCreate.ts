import {
  type Interaction,
  MessageFlags,
  type GuildMember
} from "discord.js";
import { getPlayer } from "ziplayer";

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // Only process Buttons and StringSelectMenus
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // ANTI-TIMEOUT (10062 PROTECTION): IMMEDIATELY defer reply on first line of execution
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (deferError) {
    console.error("[Interaction Defer Error]", deferError);
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId || !interaction.guild) {
    await interaction.editReply({
      content: "❌ Bảng điều khiển này chỉ có thể sử dụng trong máy chủ Discord!"
    });
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

  const player = getPlayer(guildId);
  if (!player) {
    await interaction.editReply({
      content: "❌ Không tìm thấy trình phát nhạc nào đang hoạt động trong máy chủ này!"
    });
    return;
  }

  // Handle Buttons
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

  // Handle StringSelectMenu (Action Row 2 - volt_control_menu)
  if (interaction.isStringSelectMenu() && interaction.customId === "volt_control_menu") {
    const selected = interaction.values[0];

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
        const currentAutoPlay = (player.queue as any).autoPlayEnabled ?? false;
        const nextState = !currentAutoPlay;
        player.queue.autoPlay(nextState);
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
