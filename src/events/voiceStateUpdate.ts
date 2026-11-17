import type { VoiceState } from "discord.js";
import { getPlayer } from "ziplayer";
import { createSuccessEmbed } from "../ui/playerUi";

// Map lưu trữ bộ đếm thời gian 1 phút cho từng Guild
const emptyChannelTimers = new Map<string, NodeJS.Timeout>();

/**
 * Xóa bộ đếm thời gian rời phòng khi không còn cần thiết
 */
export function clearEmptyChannelTimer(guildId: string): void {
  const timer = emptyChannelTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    emptyChannelTimers.delete(guildId);
  }
}

/**
 * Xử lý sự kiện voiceStateUpdate: Tự động rời phòng sau 1 phút khi không có người nghe
 */
export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const botMember = guild.members.me;
  if (!botMember) return;

  const botVoiceChannel = botMember.voice.channel;

  // Trường hợp 1: Bot bị ngắt kết nối khỏi kênh thoại bởi người dùng hoặc hệ thống
  if (oldState.id === botMember.id && !newState.channelId) {
    clearEmptyChannelTimer(guild.id);
    const player = getPlayer(guild.id);
    if (player && !player.destroyed) {
      player.destroy();
    }
    return;
  }

  // Nếu bot hiện không ở trong bất kỳ kênh thoại nào của máy chủ này
  if (!botVoiceChannel) {
    clearEmptyChannelTimer(guild.id);
    return;
  }

  // Chỉ xử lý nếu sự thay đổi trạng thái thoại liên quan đến kênh thoại bot đang ở
  const isRelevant =
    oldState.channelId === botVoiceChannel.id || newState.channelId === botVoiceChannel.id;
  if (!isRelevant) return;

  // Đếm số lượng thành viên là con người (loại trừ tất cả các bot)
  const humanMembers = botVoiceChannel.members.filter((member) => !member.user.bot);

  // Nếu không còn bất kỳ người nào trong phòng
  if (humanMembers.size === 0) {
    // Nếu đã có bộ đếm 1 phút đang chạy cho guild này thì giữ nguyên để tiếp tục đếm
    if (emptyChannelTimers.has(guild.id)) return;

    console.log(
      `[VoiceState] Kênh "${botVoiceChannel.name}" (Guild: ${guild.id}) không còn người nghe. Bắt đầu đếm ngược 1 phút để tự động rời phòng...`
    );

    // Bắt đầu đếm ngược 1 phút (60.000 ms)
    const timer = setTimeout(async () => {
      emptyChannelTimers.delete(guild.id);

      // Kiểm tra lại lần cuối: Bot có còn trong phòng và phòng có thực sự vẫn trống không
      const currentBotMember = guild.members.me;
      const currentBotVoice = currentBotMember?.voice.channel;
      if (!currentBotVoice || currentBotVoice.id !== botVoiceChannel.id) return;

      const currentHumans = currentBotVoice.members.filter((m) => !m.user.bot);
      if (currentHumans.size === 0) {
        console.log(
          `[VoiceState] Đã hết 1 phút phòng trống. Bot tự động rời kênh "${currentBotVoice.name}".`
        );

        const player = getPlayer(guild.id);
        if (player) {
          // Gửi thông báo đến text channel nếu có trong player.userdata
          try {
            const channel = player.userdata?.channel as any;
            if (channel && typeof channel.send === "function") {
              await channel.send({
                embeds: [
                  createSuccessEmbed(
                    "👋 TỰ ĐỘNG RỜI KÊNH THOẠI",
                    "Không có ai trong phòng thoại trong 1 phút qua. Bot đã tự động rời phòng để tối ưu tài nguyên máy chủ!"
                  )
                ]
              });
            }
          } catch (err) {
            console.error("[VoiceState Notification Error]:", err);
          }

          await player.stop();
          player.destroy();
        } else {
          currentBotMember.voice.disconnect().catch(() => {});
        }
      }
    }, 60000); // 60,000 ms = 1 phút

    emptyChannelTimers.set(guild.id, timer);
  } else {
    // Nếu vẫn còn hoặc có người tham gia vào phòng, hủy bộ đếm rời phòng ngay lập tức
    const existingTimer = emptyChannelTimers.get(guild.id);
    if (existingTimer) {
      clearEmptyChannelTimer(guild.id);
      console.log(
        `[VoiceState] Đã có thành viên tham gia lại kênh "${botVoiceChannel.name}". Đã hủy hẹn giờ rời phòng.`
      );
    }
  }
}
