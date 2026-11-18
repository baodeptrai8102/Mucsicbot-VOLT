import {
  EmbedBuilder,
  GuildMember,
  Message,
  VoiceBasedChannel,
} from "discord.js";
import { getManager, getPlayer, type Track } from "ziplayer";
import { IS_RENDER, checkCooldown, config } from "../config.js";
import { clearLeaveTimer } from "../events/voiceStateUpdate.js";
import { formatDuration } from "../ui/playerUi.js";
import {
  cleanYouTubeUrl,
  fetchYouTubeTitleViaOembed,
} from "../plugins/safeYouTubePlugin.js";

export const name = "play";
export const aliases = ["p"];
export const description = "Phát nhạc từ YouTube, SoundCloud, Spotify hoặc tìm kiếm theo từ khóa";

/**
 * Chọn bài hát tối ưu nhất từ danh sách kết quả tìm kiếm:
 * - Ưu tiên bản chính thức (Official Video, Official MV, Official Audio).
 * - Chặn rơi nhầm sang YouTube Shorts (url /shorts/, hashtag #short, hoặc thời lượng <= 60s).
 * - Chống rơi nhầm sang bản cover, parody, speed up, nightcore nếu người dùng không yêu cầu.
 * - Hỗ trợ và ưu tiên phát các bài nhạc dài 10+ phút liên tục, không bị đứt gãy.
 */
function selectBestTrack(tracks: Track[], query: string): Track | null {
  if (!tracks || tracks.length === 0) return null;
  if (tracks.length === 1) return tracks[0];

  const lowerQuery = query.toLowerCase();
  const queryTokens = lowerQuery.split(/\s+/).filter((t) => t.length > 0);

  const wantsShort = lowerQuery.includes("short");
  const wantsCover = lowerQuery.includes("cover");
  const wantsRemix = lowerQuery.includes("remix");

  let bestTrack = tracks[0];
  let highestScore = -Infinity;

  for (const track of tracks) {
    let score = 0;
    const title = (track.title || "").toLowerCase();
    const url = (track.url || "").toLowerCase();
    const durationMs = track.duration || 0; // ms

    // 1. Chống YouTube Shorts: /shorts/, #short hoặc thời lượng <= 60 giây
    const isShort = url.includes("/shorts/") || title.includes("#short") || (durationMs > 0 && durationMs <= 60000);
    if (isShort && !wantsShort) {
      score -= 500;
    }

    // 2. Chống bản cover nhảm nếu người dùng không chủ đích tìm cover
    const isCover = title.includes("cover");
    if (isCover && !wantsCover) {
      score -= 200;
    }

    // 3. Chống parody / reaction / speed up / nightcore nếu không có trong query
    if (!lowerQuery.includes("parody") && title.includes("parody")) score -= 300;
    if (!lowerQuery.includes("reaction") && title.includes("reaction")) score -= 300;
    if (!lowerQuery.includes("speed up") && (title.includes("speed up") || title.includes("sped up"))) score -= 100;
    if (!lowerQuery.includes("nightcore") && title.includes("nightcore")) score -= 100;
    if (!wantsRemix && title.includes("remix")) score -= 50;

    // 4. Ưu tiên bản chính thức (Official Music Video, Official MV, Official Audio, v.v.)
    if (title.includes("official music video") || title.includes("official mv")) {
      score += 150;
    } else if (title.includes("official audio") || title.includes("official video") || title.includes("official")) {
      score += 100;
    } else if (title.includes("mv") || title.includes("audio")) {
      score += 50;
    }

    // 5. Khớp từng từ khóa trong query của người dùng
    for (const token of queryTokens) {
      if (title.includes(token)) {
        score += 30;
      }
    }

    // 6. Hỗ trợ và ưu tiên nhạc dài (10+ phút liên tục >= 600,000ms)
    if (durationMs >= 600000) {
      if (
        lowerQuery.includes("tiếng") ||
        lowerQuery.includes("hour") ||
        lowerQuery.includes("phút") ||
        lowerQuery.includes("lofi") ||
        lowerQuery.includes("chill") ||
        lowerQuery.includes("relax") ||
        lowerQuery.includes("mix") ||
        lowerQuery.includes("tập trung") ||
        lowerQuery.includes("ngủ ngon")
      ) {
        score += 120;
      } else {
        score += 25;
      }
    } else if (durationMs > 60000) {
      score += 30;
    }

    if (score > highestScore) {
      highestScore = score;
      bestTrack = track;
    }
  }

  return bestTrack;
}

export async function execute(message: Message, args: string[]): Promise<void> {
  // 1. Kiểm tra chống spam lệnh 5 giây
  const cooldownCheck = checkCooldown(message.author.id, "play");
  if (cooldownCheck.onCooldown) {
    await message.reply(
      `⚠️ Anh Bo OniChan đợi một chút nhé! Vui lòng chờ **${cooldownCheck.remainingSeconds} giây** trước khi dùng lại lệnh 🌸`
    );
    return;
  }

  const member = message.member as GuildMember;
  const voiceChannel = member?.voice?.channel as VoiceBasedChannel | null;

  if (!voiceChannel) {
    const errorEmbed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle("❌ Chưa vào kênh thoại")
      .setDescription(
        `Anh Bo OniChan ơi, anh cần tham gia vào một kênh thoại trước khi gọi em phát nhạc nhé! 🦊🌸\nVí dụ: \`${config.prefix}play Có Chắc Yêu Là Đây\``
      );
    await message.reply({ embeds: [errorEmbed] });
    return;
  }

  // Kiểm tra quyền của bot trong kênh thoại
  const permissions = voiceChannel.permissionsFor(message.client.user!);
  if (!permissions?.has("Connect") || !permissions?.has("Speak")) {
    const permEmbed = new EmbedBuilder()
      .setColor(config.colors.error)
      .setTitle("🔒 Thiếu quyền truy cập")
      .setDescription("Em không có đủ quyền **Kết nối (Connect)** hoặc **Nói (Speak)** trong kênh thoại này rồi!");
    await message.reply({ embeds: [permEmbed] });
    return;
  }

  let cleanQuery = args.join(" ").trim();
  if (!cleanQuery) {
    const usageEmbed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle("💡 Cách dùng lệnh !play")
      .setDescription(
        `Anh Bo hãy nhập tên bài hát hoặc liên kết sau lệnh nhé!\n\n` +
        `**Cú pháp:** \`${config.prefix}play <tên bài hát hoặc URL>\`\n` +
        `**Ví dụ:** \`${config.prefix}play See Tình\``
      );
    await message.reply({ embeds: [usageEmbed] });
    return;
  }

  // Loại bỏ bọc <url> nếu Discord tự động bọc liên kết
  if (cleanQuery.startsWith("<") && cleanQuery.endsWith(">")) {
    cleanQuery = cleanQuery.slice(1, -1).trim();
  }
  const isDirectUrl = /^https?:\/\//i.test(cleanQuery);

  const loadingMsg = await message.reply("🔎 *Tiểu hồ ly đang tìm kiếm và giải mã nguồn nhạc, Anh Bo đợi chút xíu nhé...* ✨");

  try {
    // 2. Sử dụng chuẩn singleton của ziplayer
    const manager = getManager();
    if (!manager) {
      throw new Error("ZiPlayer Manager chưa được khởi tạo!");
    }

    const guildId = message.guildId!;
    clearLeaveTimer(guildId);
    let player = getPlayer(guildId);

    if (!player) {
      player = await manager.create(guildId, {
        leaveOnEnd: true,
        leaveOnEmpty: false,
        volume: config.defaultVolume,
        userdata: {
          textChannelId: message.channelId,
        },
      });
      // Tắt autoplay ngầm để tiết kiệm 0.1 vCPU và chống lỗi 403 từ endpoint /youtubei/v1/next
      player.queue.autoPlay(false);
    } else {
      player.userdata = player.userdata || {};
      player.userdata.textChannelId = message.channelId;
      player.queue.autoPlay(false);
    }

    // 3. Kết nối an toàn vào kênh thoại: nếu đã "ready" cùng kênh thì đi thẳng vào phát nhạc (không setTimeout)
    try {
      const isReadySameChannel =
        (player.connection?.state as any)?.status === "ready" &&
        (player as any).channel?.id === voiceChannel.id;

      if (!isReadySameChannel) {
        const needsConnect =
          !player.connection ||
          (player as any).channel?.id !== voiceChannel.id ||
          (player.connection as any)?.state?.status === "destroyed" ||
          (player.connection as any)?.state?.status === "disconnected";

        if (needsConnect) {
          await player.connect(voiceChannel as any);
          player.queue.autoPlay(false);
        }
      }
    } catch (connError) {
      console.error("[Play Command] Lỗi kết nối kênh thoại:", connError);
      const connErrEmbed = new EmbedBuilder()
        .setColor(config.colors.error)
        .setTitle("❌ Không thể kết nối kênh thoại")
        .setDescription("Tiểu hồ ly không thể kết nối hoặc tham gia vào kênh thoại của Anh Bo. Vui lòng kiểm tra quyền và thử lại sau nhé! 🦊🌸");
      await loadingMsg.edit({ content: null, embeds: [connErrEmbed] }).catch(() => {});
      return;
    }

    // 4. Phân luồng nguồn nhạc: URL trực tiếp vs Tên bài hát (text search)
    let targetToPlay: any = cleanQuery;
    let selectedTrack: Track | null = null;

    if (isDirectUrl) {
      // Khi người dùng nhập link URL trực tiếp: chuẩn hóa xóa tham số tracking rác
      targetToPlay = cleanYouTubeUrl(cleanQuery);
    } else {
      // Khi người dùng nhập tên bài (text search query):
      // YouTube là nguồn số 1 trên cả Render lẫn VS Code
      try {
        const searchResult = await player.search(cleanQuery, message.author.id);
        if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
          const bestTrack = selectBestTrack(searchResult.tracks, cleanQuery);
          if (bestTrack) {
            selectedTrack = bestTrack;
            targetToPlay = bestTrack.url || bestTrack;
          }
        }
      } catch (searchError) {
        console.warn("[Play Command] Tìm kiếm YouTube thất bại, thử fallback sang SoundCloud:", searchError);
      }

      // Chỉ khi YouTube không tìm thấy kết quả thì mới fallback tìm kiếm qua SoundCloud
      if (!selectedTrack) {
        try {
          const scPlugin = ((manager as any).plugins as any[])?.find((p: any) => p.name === "soundcloud");
          if (scPlugin) {
            const scResult = await scPlugin.search(cleanQuery, message.author.id);
            if (scResult && scResult.tracks && scResult.tracks.length > 0) {
              const bestTrack = selectBestTrack(scResult.tracks, cleanQuery);
              if (bestTrack) {
                selectedTrack = bestTrack;
                targetToPlay = bestTrack.url || bestTrack;
              }
            }
          }
        } catch (scErr) {
          console.warn("[Play Command] Fallback tìm kiếm SoundCloud thất bại:", scErr);
          targetToPlay = cleanQuery;
        }
      }
    }

    // 5. Phát nhạc hoặc thêm vào hàng đợi, kiểm tra kỹ trường hợp thất bại và fallback SoundCloud
    let success = false;
    try {
      // Đảm bảo tuyệt đối không autoplay ngầm (tiết kiệm 0.1 vCPU và chống lỗi 403 /youtubei/v1/next)
      player.queue.autoPlay(false);
      success = await player.play(targetToPlay, message.author.id);
    } catch (playErr) {
      console.warn("[Play Command] Lỗi player.play ban đầu:", playErr);
      success = false;
    }

    // Nếu phát thất bại và là link YouTube: fallback qua YouTube oEmbed -> SoundCloud
    const isYouTubeUrl = isDirectUrl && (cleanQuery.includes("youtube.com") || cleanQuery.includes("youtu.be"));
    if (!success && isYouTubeUrl) {
      const fallbackKey = `fallbackHandled_${cleanQuery}`;
      const isHandled = Boolean(
        (player.userdata && player.userdata[fallbackKey]) ||
        ((player as any).data && (player as any).data[fallbackKey])
      );

      if (!isHandled) {
        if (!player.userdata) player.userdata = {};
        player.userdata[fallbackKey] = true;
        if (!(player as any).data) (player as any).data = {};
        (player as any).data[fallbackKey] = true;

        const oembedTitle = await fetchYouTubeTitleViaOembed(cleanQuery);
        const searchTitle = oembedTitle || cleanQuery;

        let scTrack: Track | null = null;
        try {
          const scPlugin = ((manager as any).plugins as any[])?.find((p: any) => p.name === "soundcloud");
          if (scPlugin && searchTitle) {
            const scResult = await scPlugin.search(searchTitle, message.author.id);
            if (scResult && scResult.tracks && scResult.tracks.length > 0) {
              const bestSc = selectBestTrack(scResult.tracks, searchTitle) || scResult.tracks[0];
              if (bestSc) {
                scTrack = bestSc;
              }
            }
          }
        } catch (scSearchErr) {
          console.warn("[Play Command] Fallback SoundCloud search thất bại:", scSearchErr);
        }

        if (scTrack) {
          try {
            success = await player.play(scTrack.url || scTrack, message.author.id);
            if (success) {
              selectedTrack = scTrack;
            }
          } catch (scPlayErr) {
            console.warn("[Play Command] Fallback SoundCloud play thất bại:", scPlayErr);
          }
        } else if (searchTitle) {
          try {
            success = await player.play(`soundcloud:${searchTitle}`, message.author.id);
          } catch {}
        }

        if (success && message.channel && "send" in message.channel) {
          await (message.channel as any).send(
            `🔄 Nhận diện luồng YouTube bị giới hạn, tiểu hồ ly đã tự động chuyển nguồn âm thanh "${searchTitle}" sang SoundCloud mượt mà cho Anh Bo rồi nhé! 🌸✨`
          ).catch(() => {});
        }
      }
    }

    if (!success) {
      const notFoundEmbed = new EmbedBuilder()
        .setColor(config.colors.error)
        .setTitle("🔎 Không tìm thấy kết quả hoặc phát thất bại")
        .setDescription(
          `Tiểu hồ ly không tìm thấy bài hát hoặc giải mã thất bại với yêu cầu: \`${cleanQuery}\`.\n` +
          `Anh Bo hãy kiểm tra lại đường link hoặc thử từ khóa khác nhé! ✨`
        );
      await loadingMsg.edit({ content: null, embeds: [notFoundEmbed] }).catch(() => {});
      return;
    }

    const currentTrack = selectedTrack || player.currentTrack;
    const isNowPlaying = player.queue.size === 0;

    const successEmbed = new EmbedBuilder()
      .setColor(config.colors.success)
      .setAuthor({
        name: isNowPlaying ? "Đang tải bài hát..." : "Đã thêm vào hàng đợi",
        iconURL: "https://cdn.discordapp.com/emojis/853635082594615316.webp?size=96&quality=lossless",
      })
      .setDescription(
        currentTrack
          ? `🎶 **[${currentTrack.title}](${currentTrack.url})**\n⏱️ Thời lượng: \`${formatDuration(currentTrack.duration)}\` | Yêu cầu bởi: <@${message.author.id}>`
          : `🎶 Đã thêm yêu cầu: \`${cleanQuery}\` vào danh sách chờ thành công!`
      )
      .setFooter({ text: `Vị trí trong hàng đợi: #${player.queue.size + 1} • Âm lượng: ${player.volume}% • Lệnh: !help` });

    if (currentTrack?.thumbnail) {
      successEmbed.setThumbnail(currentTrack.thumbnail);
    }

    await loadingMsg.edit({ content: null, embeds: [successEmbed] });
  } catch (error) {
    console.error("[Play Command] Lỗi khi xử lý phát nhạc:", error);
    const failEmbed = new EmbedBuilder()
      .setColor(config.colors.error)
      .setTitle("⚠️ Đã xảy ra sự cố")
      .setDescription("Có trục trặc khi kết nối hoặc giải mã âm thanh. Anh Bo OniChan vui lòng thử lại sau nhé! 🦊");
    await loadingMsg.edit({ content: null, embeds: [failEmbed] }).catch(() => {});
  }
}

