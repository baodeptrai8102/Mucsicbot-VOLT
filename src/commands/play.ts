import { EmbedBuilder, type Message } from "discord.js";
import type { Command } from "./types";
import { CONFIG } from "../config";
import { createErrorEmbed, createSearchTimeoutEmbed } from "../ui/playerUi";

const importEsm = new Function("specifier", "return import(specifier)") as <T = any>(
  specifier: string
) => Promise<T>;

function isHeavyPlaylistUrl(rawInput: string): boolean {
  const lower = rawInput.toLowerCase();
  return (
    lower.includes("open.spotify.com/playlist/") ||
    lower.includes("open.spotify.com/album/") ||
    lower.includes("youtube.com/playlist?list=")
  );
}

function parseYouTubeInput(rawInput: string): {
  cleanUrl: string;
  videoId: string | null;
} {
  const cleaned = rawInput.replace(/^<|>$/g, "").trim();
  const match = cleaned.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );

  if (match && !cleaned.includes("list=")) {
    const videoId = match[1];
    return {
      cleanUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoId
    };
  }

  return { cleanUrl: cleaned, videoId: match ? match[1] : null };
}

function simplifySongTitle(title: string): string {
  return title
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/「[^」]*」/g, " ")
    .replace(/『[^』]*』/g, " ")
    .replace(/\|.*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveYouTubeMeta(videoId: string): Promise<{
  title: string | null;
  thumbnail: string;
}> {
  const fallbackThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  try {
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (!res.ok) {
      return { title: null, thumbnail: fallbackThumbnail };
    }
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    return {
      title: data.title?.trim() || null,
      thumbnail: data.thumbnail_url?.trim() || fallbackThumbnail
    };
  } catch {
    return { title: null, thumbnail: fallbackThumbnail };
  }
}

export const playCommand: Command = {
  name: "play",
  aliases: ["p"],
  description: "Ưu tiên phát nhạc từ YouTube, hỗ trợ đầy đủ SoundCloud và Spotify",
  usage: "!play <link YouTube / tên bài hát>",
  execute: async (message: Message, args: string[]): Promise<void> => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply({
        embeds: [createErrorEmbed("Bạn cần tham gia một kênh thoại trước khi dùng lệnh phát nhạc!")]
      });
      return;
    }

    const rawQuery = args.join(" ").trim();
    if (!rawQuery) {
      await message.reply({
        embeds: [
          createErrorEmbed(
            "Vui lòng dán link YouTube hoặc nhập tên bài hát!\nVí dụ: `!play https://youtu.be/tlDuuw2rkm4` hoặc `!play Đi Về Nhà`"
          )
        ]
      });
      return;
    }

    const isRender = Boolean(
      CONFIG.IS_RENDER || process.env.RENDER || process.env.RENDER_SERVICE_ID
    );

    if (isRender && isHeavyPlaylistUrl(rawQuery)) {
      await message.reply({
        embeds: [
          createErrorEmbed(
            "Vui lòng gửi link **từng video lẻ** (kể cả video dài 20–60 phút) thay vì dán cả danh sách phát Playlist!"
          )
        ]
      });
      return;
    }

    const guildId = message.guildId;
    if (!guildId) {
      await message.reply({
        embeds: [createErrorEmbed("Lệnh này chỉ có thể sử dụng trong máy chủ Discord!")]
      });
      return;
    }

    const { getManager, getPlayer } = await importEsm<typeof import("ziplayer")>("ziplayer");
    const manager = getManager();
    if (!manager) {
      await message.reply({
        embeds: [createErrorEmbed("Hệ thống âm thanh đang khởi động, thử lại sau 2 giây!")]
      });
      return;
    }

    let player = getPlayer(guildId);
    if (!player) {
      player = await manager.create(guildId, {
        leaveOnEnd: true,
        leaveOnEmpty: true,
        volume: 100,
        preload: {
          enabled: false,
          autoDisableInLowPerformance: true
        },
        antiStuck: {
          enabled: false,
          maxRetries: 0,
          controlledSkipThreshold: 1
        },
        userdata: { channel: message.channel }
      });
    } else {
      player.userdata = { ...(player.userdata || {}), channel: message.channel };
    }

    const isConnectionReady =
      Boolean(player.connection) &&
      (player.connection?.state as any)?.status === "ready";

    const { cleanUrl, videoId } = parseYouTubeInput(rawQuery);
    const isAnyUrl = /^https?:\/\//i.test(cleanUrl);

    let connectionFailed: any = null;
    const [loadingMsg, , ytMeta] = await Promise.all([
      message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(CONFIG.EMBED_COLOR)
            .setDescription(
              videoId
                ? "⚡ **Đang vào kênh thoại và tải luồng âm thanh trực tiếp từ YouTube...**"
                : "⚡ **Đang vào kênh thoại và tìm kiếm bài hát...**"
            )
        ]
      }),
      !isConnectionReady
        ? player.connect(voiceChannel as any).catch((err: any) => {
            if (!err?.message?.includes("aborted")) {
              connectionFailed = err;
            }
          })
        : Promise.resolve(),
      videoId ? resolveYouTubeMeta(videoId) : Promise.resolve(null)
    ]);

    if (connectionFailed) {
      await loadingMsg.edit({
        embeds: [
          createErrorEmbed(
            `Không thể kết nối vào kênh thoại: ${connectionFailed?.message || "Kiểm tra quyền của bot!"}`
          )
        ]
      });
      return;
    }

    if (!isConnectionReady) {
      await new Promise((resolve) => setTimeout(resolve, 900));
    }

    const youtubeThumbnail = ytMeta?.thumbnail || null;
    const youtubeTitle = ytMeta?.title || null;
    const requestedById = message.author.id;

    if (videoId && youtubeThumbnail) {
      const currentData = (player.userdata || {}) as Record<string, any>;
      const ytMetaQueue = Array.isArray(currentData.ytMetaQueue)
        ? [...currentData.ytMetaQueue]
        : [];
      ytMetaQueue.push({
        videoId,
        url: cleanUrl,
        title: youtubeTitle || "",
        simpleTitle: youtubeTitle ? simplifySongTitle(youtubeTitle).toLowerCase() : "",
        thumbnail: youtubeThumbnail
      });
      player.userdata = {
        ...currentData,
        channel: message.channel,
        ytMetaQueue
      };
    }

    const tryPlay = async (targetQuery: string, timeoutMs: number) => {
      return Promise.race([
        player!.play(targetQuery, requestedById),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("SEARCH_TIMEOUT")), timeoutMs)
        )
      ]);
    };

    try {
      let playedLabel = youtubeTitle || cleanUrl;
      let result: any = null;

      if (isAnyUrl) {
        // Khi dán link (YouTube, SoundCloud hoặc Spotify): phát đúng link đó
        result = await tryPlay(cleanUrl, 25000);
      } else {
        // Khi nhập tên bài hát: ưu tiên kết quả từ YouTube trước, không có mới sang SoundCloud/Spotify
        let preferredQuery = cleanUrl;
        if (typeof (manager as any).search === "function") {
          const searchRes = await Promise.race([
            (manager as any).search(cleanUrl),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
          ]);
          const tracks: any[] = Array.isArray(searchRes?.tracks) ? searchRes.tracks : [];
          const ytTrack = tracks.find(
            (t) =>
              String(t?.source || "").toLowerCase() === "youtube" ||
              /(?:youtube\.com|youtu\.be)/i.test(String(t?.url || ""))
          );
          const chosenTrack = ytTrack || tracks[0];
          if (chosenTrack?.url) {
            preferredQuery = chosenTrack.url;
            if (chosenTrack.title) {
              playedLabel = chosenTrack.title;
            }
          }
        }
        result = await tryPlay(preferredQuery, 20000);
      }

      if (!result) {
        await loadingMsg.edit({
          embeds: [
            createErrorEmbed(
              videoId
                ? `Không thể lấy luồng âm thanh từ video **${playedLabel}** (video có thể bị giới hạn độ tuổi hoặc vùng quốc gia).`
                : "Không tìm thấy bài hát phù hợp. Hãy thử nhập tên bài hát rõ ràng hơn!"
            )
          ]
        });
        return;
      }

      (player as any).setVolume?.(100);
      if (player.isPaused) {
        await player.resume();
      }

      const acceptedEmbed = new EmbedBuilder()
        .setColor(CONFIG.EMBED_COLOR)
        .setTitle("⚡ VOLT MUSIC - ĐÃ TIẾP NHẬN")
        .setDescription(`🎶 Đã nạp: **${playedLabel}**\nNhạc đang được phát ngay bây giờ!`)
        .setFooter({ text: "VOLT Music • YouTube Priority Engine" })
        .setTimestamp();

      if (youtubeThumbnail) {
        acceptedEmbed.setThumbnail(youtubeThumbnail);
      }

      await loadingMsg.edit({ embeds: [acceptedEmbed] });
    } catch (err: any) {
      if (err?.message === "SEARCH_TIMEOUT" || String(err).toLowerCase().includes("timeout")) {
        await loadingMsg.edit({
          embeds: [createSearchTimeoutEmbed(25)]
        });
      } else {
        console.error("[Play Execution Error]:", err);
        await loadingMsg.edit({
          embeds: [
            createErrorEmbed(
              `Không thể phát bài hát này: ${err?.message || "Vui lòng thử lại sau giây lát!"}`
            )
          ]
        });
      }
    }
  }
};