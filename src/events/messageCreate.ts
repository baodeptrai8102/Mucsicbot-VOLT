import type { Message } from "discord.js";
import { CONFIG } from "../config";
import { getCommand } from "../commands";
import { createErrorEmbed } from "../ui/playerUi";

export async function handleMessageCreate(message: Message): Promise<void> {
  // Ignore bots and direct messages outside guild
  if (message.author.bot || !message.guild) return;

  // Check prefix
  if (!message.content.startsWith(CONFIG.PREFIX)) return;

  const rawContent = message.content.slice(CONFIG.PREFIX.length).trim();
  if (!rawContent) return;

  const [commandName, ...args] = rawContent.split(/\s+/);
  if (!commandName) return;

  const command = getCommand(commandName);
  if (!command) return;

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
