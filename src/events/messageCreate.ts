import type { Message } from "discord.js";
import { CONFIG } from "../config";
import { getCommand } from "../commands";
import { createErrorEmbed } from "../ui/playerUi";

const importEsm = new Function("specifier", "return import(specifier)") as <T = any>(
  specifier: string
) => Promise<T>;

// Chặn spam lệnh chat: 5 giây / người
const COMMAND_COOLDOWN_MS = 5000;
const MAX_RENDER_QUEUE_SIZE = 20;
const commandCooldowns = new Map<string, { until: number; warned: boolean }>();

// Tự động dọn RAM mỗi 60 giây
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of commandCooldowns.entries()) {
    if (now >= entry.until) {
      commandCooldowns.delete(key);
    }
  }
}, 60_000).unref();

export async function handleMessageCreate(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(CONFIG.PREFIX)) return;

  const rawContent = message.content.slice(CONFIG.PREFIX.length).trim();
  if (!rawContent) return;

  const [commandName, ...args] = rawContent.split(/\s+/);
  if (!commandName) return;

  const command = getCommand(commandName);
  if (!command) return;

  // Kiểm tra chống spam 5 giây (chỉ nhắc 1 lần mỗi chu kỳ để tránh lag Discord API)
  const cooldownKey = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const activeCooldown = commandCooldowns.get(cooldownKey);

  if (activeCooldown && now < activeCooldown.until) {
    if (!activeCooldown.warned) {
      activeCooldown.warned = true;
      const left = ((activeCooldown.until - now) / 1000).toFixed(1);
      const warnMsg = await message
        .reply(`⏳ **Chống spam:** Vui lòng chờ **${left}s** trước khi dùng lệnh tiếp theo!`)
        .catch(() => null);
      if (warnMsg) {
        setTimeout(() => warnMsg.delete().catch(() => {}), 3500);
      }
    }
    return;
  }

  commandCooldowns.set(cooldownKey, {
    until: now + COMMAND_COOLDOWN_MS,
    warned: false
  });

  // Giới hạn hàng chờ tối đa 20 bài trên Render để chống tràn 512MB RAM & giật tiếng
  const lowerCmd = commandName.toLowerCase();
  const isRender = Boolean(
    CONFIG.IS_RENDER || process.env.RENDER || process.env.RENDER_SERVICE_ID
  );

  if (isRender && (lowerCmd === "play" || lowerCmd === "p")) {
    try {
      const { getPlayer } = await importEsm<typeof import("ziplayer")>("ziplayer");
      const player = getPlayer(message.guild.id);
      if (player && player.queue.size >= MAX_RENDER_QUEUE_SIZE) {
        await message
          .reply({
            embeds: [
              createErrorEmbed(
                `Hàng chờ đã đạt tối đa **${MAX_RENDER_QUEUE_SIZE} bài** để giữ nhạc mượt mà. Vui lòng đợi bớt bài rồi thêm tiếp!`
              )
            ]
          })
          .catch(() => {});
        return;
      }
    } catch {
      // Bỏ qua nếu player chưa khởi tạo
    }
  }

  try {
    await command.execute(message, args);
  } catch (error: any) {
    console.error(`[Command Error] Command: ${commandName}`, error);
    try {
      await message.reply({
        embeds: [
          createErrorEmbed(
            `Đã xảy ra lỗi khi thực thi lệnh \`${commandName}\`: ${error?.message || "Lỗi nội bộ"}`
          )
        ]
      });
    } catch (replyErr) {
      console.error("[Message Reply Error]", replyErr);
    }
  }
}