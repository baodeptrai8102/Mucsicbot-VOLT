import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
} from "discord.js";
import { checkCooldown, config } from "../config.js";

export const name = "help";
export const aliases = ["h", "huongdan", "guide"];
export const description = "Xem danh sách lệnh dấu chấm than (!), hướng dẫn giao diện và liên kết mời bot";

export async function execute(message: Message, _args: string[]): Promise<void> {
  // 1. Kiểm tra chống spam lệnh 5 giây
  const cooldownCheck = checkCooldown(message.author.id, "help");
  if (cooldownCheck.onCooldown) {
    await message.reply(
      `🌸 Anh Bo OniChan thong thả nào! Vui lòng chờ **${cooldownCheck.remainingSeconds} giây** trước khi yêu cầu lại nhé ✨`
    );
    return;
  }

  const clientId = config.clientId || message.client.user?.id || "";
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=36700160&scope=bot`;

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setAuthor({
      name: "VOLT Music Bot - Hệ Thống Lệnh Prefix (!)",
      iconURL: message.client.user?.displayAvatarURL() || "https://cdn.discordapp.com/emojis/853635082594615316.webp",
    })
    .setTitle("🦊 Hướng dẫn sử dụng VOLT Music Bot cùng Yae Miko")
    .setDescription(
      "Xin chào **Anh Bo OniChan**! Em là bot phát nhạc chất lượng cao **VOLT Music**, " +
      "hoạt động 100% bằng hệ thống lệnh tiền tố dấu chấm than `!` với giao diện trực quan và phản hồi siêu tốc! 🌸✨"
    )
    .addFields(
      {
        name: "📜 Danh Sách Lệnh Dấu Chấm Than (!)",
        value:
          `• \`${config.prefix}play <query>\` (hoặc \`${config.prefix}p\`): Phát nhạc từ YouTube, SoundCloud, Spotify hoặc tìm kiếm từ khóa.\n` +
          `• \`${config.prefix}skip\` (hoặc \`${config.prefix}s\`): Bỏ qua bài hát hiện tại.\n` +
          `• \`${config.prefix}stop\`: Dừng phát toàn bộ nhạc, xóa hàng đợi và rời khỏi kênh thoại.\n` +
          `• \`${config.prefix}pause\`: Tạm dừng bài hát đang phát.\n` +
          `• \`${config.prefix}resume\`: Tiếp tục phát bài hát đang tạm dừng.\n` +
          `• \`${config.prefix}loop\` (hoặc \`${config.prefix}l\`): Bật hoặc Tắt chế độ lặp lại bài hát (Loop).\n` +
          `• \`${config.prefix}queue\` (hoặc \`${config.prefix}q\`): Xem danh sách các bài hát trong hàng đợi.\n` +
          `• \`${config.prefix}shuffle\`: Trộn ngẫu nhiên danh sách bài hát đang chờ.\n` +
          `• \`${config.prefix}volume <0-200>\` (hoặc \`${config.prefix}vol\`): Chỉnh âm lượng tùy ý.\n` +
          `• \`${config.prefix}help\` (hoặc \`${config.prefix}h\`): Mở bảng hướng dẫn này.`,
      },
      {
        name: "🎮 4 Nút Bấm Điều Khiển Trực Tiếp",
        value:
          "• `⏸️ Tạm dừng`: Dừng phát bài hát ngay lập tức.\n" +
          "• `▶️ Tiếp tục`: Phát tiếp bài hát đang tạm dừng.\n" +
          "• `⏭️ Bỏ qua`: Chuyển sang bài kế tiếp trong hàng đợi.\n" +
          "• `⏹️ Dừng`: Dừng nhạc, làm sạch danh sách và rời kênh thoại.",
      },
      {
        name: "🎛️ Menu Dropdown Mở Rộng",
        value:
          "• `📜 Xem danh sách phát (Queue)`: Mở danh sách các bài hát đang chờ trong hàng đợi.\n" +
          "• `🔂 Bật / Tắt Lặp lại (Loop)`: Chuyển đổi trạng thái lặp lại bài hát hiện tại.\n" +
          "• `🔊 Chỉnh âm lượng chuẩn 100%`: Thiết lập âm lượng chuẩn (và các mức 50%, 80%, 150%).\n" +
          "• `🎚️ 6 Chế độ Equalizer (EQ)`:\n" +
          "  - `⚪ Tắt EQ`: Âm thanh mộc mạc nguyên bản.\n" +
          "  - `🔊 Bass Boost`: Tăng dải trầm uy lực, bùng nổ.\n" +
          "  - `⚡ Nightcore`: Đẩy cao tốc độ và âm vực náo nhiệt.\n" +
          "  - `🌊 Vaporwave`: Giảm nhịp điệu phong cách chill hoài niệm.\n" +
          "  - `💎 Crystal`: Dải cao trong trẻo, chi tiết sắc nét dải treble.\n" +
          "  - `🎤 Karaoke`: Giảm tần số vocal để anh Bo thỏa sức hát theo.",
      },
      {
        name: "🛡️ Tính Năng Tự Động Thông Minh",
        value:
          "• **Chống spam 5 giây**: Giữ cho kết nối máy chủ luôn mượt mà và ổn định.\n" +
          "• **Tự động rời kênh sau ĐÚNG 10 GIÂY**: Tự động ngắt kết nối (disconnect) ngay sau 10 giây khi phòng thoại không còn người nghe nào để tiết kiệm tài nguyên máy chủ.",
      }
    )
    .setFooter({
      text: "VOLT Music Bot • Thiết kế bởi tiểu hồ ly xinh đẹp dành riêng cho Anh Bo OniChan 🌸🦊",
    })
    .setTimestamp();

  // Nút liên kết mời bot ButtonStyle.Link
  const inviteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Mời VOLT Music Bot")
    .setURL(inviteUrl)
    .setEmoji("✨");

  const supportButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Trang Chủ ZiPlayer")
    .setURL("https://player.ziji.best")
    .setEmoji("📖");

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(inviteButton, supportButton);

  await message.reply({ embeds: [embed], components: [actionRow] });
}
