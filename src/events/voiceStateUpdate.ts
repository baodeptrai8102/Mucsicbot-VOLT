import { Events, TextChannel, VoiceState } from "discord.js";
import { getManager, getPlayer } from "ziplayer";
import { config } from "../config.js";

// Lưu trữ các bộ đếm thời gian tự động rời kênh cho từng server
const leaveTimers = new Map<string, NodeJS.Timeout>();

/**
 * Hủy bộ đếm rời phòng của máy chủ (dùng khi có người vào, thêm bài mới, hoặc player bị hủy)
 */
export function clearLeaveTimer(guildId: string): boolean {
  if (leaveTimers.has(guildId)) {
    clearTimeout(leaveTimers.get(guildId)!);
    leaveTimers.delete(guildId);
    return true;
  }
  return false;
}

export const name = Events.VoiceStateUpdate;

export async function execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const guild = oldState.guild || newState.guild;
  const guildId = guild.id;
  const botMember = guild.members.me;

  // Nếu bot không ở trong server hoặc không ở trong kênh thoại nào
  if (!botMember || !botMember.voice.channel) {
    if (leaveTimers.has(guildId)) {
      clearTimeout(leaveTimers.get(guildId)!);
      leaveTimers.delete(guildId);
    }
    return;
  }

  const botVoiceChannel = botMember.voice.channel;

  // Lọc danh sách thành viên thực tế (người dùng thật, bỏ qua các bot)
  const nonBotMembers = botVoiceChannel.members.filter((member) => !member.user.bot);

  // Trường hợp 1: Không còn người nghe nào trong kênh thoại của bot
  if (nonBotMembers.size === 0) {
    // Nếu chưa có timer đếm ngược, thiết lập bộ đếm ĐÚNG 10 GIÂY
    if (!leaveTimers.has(guildId)) {
      const timeoutSeconds = Math.round(config.autoLeaveTimeoutMs / 1000);
      console.log(`[VoiceStateUpdate] Kênh thoại ${botVoiceChannel.name} (${guildId}) trống người. Bắt đầu đếm ngược ${timeoutSeconds}s tự động ngắt kết nối...`);

      const player = getPlayer(guildId);
      const textChannelId = player?.userdata?.textChannelId as string | undefined;

      if (textChannelId) {
        const textChannel = guild.channels.cache.get(textChannelId) as TextChannel | undefined;
        textChannel?.send({
          content: `⌛ Kênh thoại hiện không còn người nghe. Em sẽ tự động rời phòng sau **${timeoutSeconds} giây** nếu không có ai quay lại nhé Anh Bo OniChan! 🦊🌸`,
        }).catch(() => {});
      }

      const timer = setTimeout(async () => {
        leaveTimers.delete(guildId);

        // Kiểm tra lại lần cuối trước khi ngắt kết nối
        const currentBotChannel = guild.members.me?.voice.channel;
        if (!currentBotChannel) return;

        const stillEmpty = currentBotChannel.members.filter((m) => !m.user.bot).size === 0;
        if (stillEmpty) {
          console.log(`[VoiceStateUpdate] Kênh thoại (${guildId}) vẫn trống sau ${timeoutSeconds}s. Tiến hành ngắt kết nối và dọn dẹp player.`);
          const activePlayer = getPlayer(guildId);
          if (activePlayer) {
            activePlayer.stop();
            activePlayer.queue.clear();
            await activePlayer.disconnect().catch(() => {});
            activePlayer.destroy();
          }

          const manager = getManager();
          if (manager) {
            manager.delete(guildId);
          }

          if (textChannelId) {
            const textChannel = guild.channels.cache.get(textChannelId) as TextChannel | undefined;
            textChannel?.send({
              content: `👋 Đã tự động rời kênh thoại và dọn dẹp hàng đợi sau **${timeoutSeconds} giây** không có người nghe để tiết kiệm tài nguyên máy chủ! Hẹn gặp lại nhé! 🌸✨`,
            }).catch(() => {});
          }
        }
      }, config.autoLeaveTimeoutMs);

      leaveTimers.set(guildId, timer);
    }
  } else {
    // Trường hợp 2: Có người nghe quay lại phòng thoại, hủy bộ đếm rời phòng ngay
    if (leaveTimers.has(guildId)) {
      console.log(`[VoiceStateUpdate] Có người nghe đã quay lại kênh thoại (${guildId}). Hủy bộ đếm tự động rời.`);
      clearTimeout(leaveTimers.get(guildId)!);
      leaveTimers.delete(guildId);

      const player = getPlayer(guildId);
      const textChannelId = player?.userdata?.textChannelId as string | undefined;
      if (textChannelId) {
        const textChannel = guild.channels.cache.get(textChannelId) as TextChannel | undefined;
        textChannel?.send({
          content: "✨ Có người nghe quay lại rồi! Tiểu hồ ly tiếp tục phát nhạc phục vụ mọi người nhé! 🎶🦊",
        }).catch(() => {});
      }
    }
  }
}
