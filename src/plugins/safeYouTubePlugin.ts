import { YouTubePlugin, type PluginOptions } from "@ziplayer/plugin";
import { getManager, type Track, type StreamInfo, type SearchResult } from "ziplayer";
import { Readable, PassThrough } from "node:stream";

/**
 * Xóa sạch các tham số tracking rác như ?si=..., &si=..., feature, pp, fbclid
 */
export function cleanYouTubeUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
      parsed.searchParams.delete("si");
      parsed.searchParams.delete("feature");
      parsed.searchParams.delete("pp");
      parsed.searchParams.delete("fbclid");
      return parsed.toString();
    }
    return url;
  } catch {
    return url
      .replace(/([?&])si=[^&]+(&|$)/g, (_m, p1, p2) => (p2 === "&" ? p1 : ""))
      .replace(/[?&]$/, "");
  }
}

/**
 * Trích xuất Video ID an toàn từ URL hoặc string ID
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const cleaned = cleanYouTubeUrl(input);
  try {
    const u = new URL(cleaned);
    if (u.hostname === "youtu.be" || u.hostname === "www.youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.replace("/shorts/", "").split("/")[0] || null;
      if (u.pathname.startsWith("/embed/")) return u.pathname.replace("/embed/", "").split("/")[0] || null;
    }
    return null;
  } catch {
    const match = cleaned.match(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/|^)([a-zA-Z0-9_-]{11})(?:[?&]|$)/);
    return match ? match[1] : null;
  }
}

/**
 * Lấy tiêu đề YouTube qua oEmbed (Google Datacenter-safe, timeout 3000ms)
 */
export async function fetchYouTubeTitleViaOembed(url: string): Promise<string | null> {
  try {
    const cleaned = cleanYouTubeUrl(url);
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleaned)}&format=json`;
    const res = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return typeof data?.title === "string" ? data.title.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Lớp bọc an toàn SafeYouTubePlugin:
 * - Chuẩn hóa link YouTube, xóa tracking rác (?si=...)
 * - Khi getStream() gặp lỗi 403 hoặc thất bại, thử luân phiên các clients: IOS, ANDROID, TV_EMBEDDED, TV
 * - Chỉ khi YouTube hoàn toàn không trích xuất được thì mới fallback SoundCloud bằng tiêu đề từ YouTube oEmbed
 */
export class SafeYouTubePlugin extends YouTubePlugin {
  constructor(options?: PluginOptions) {
    super(options);
  }

  override canHandle(query: string): boolean {
    const cleaned = cleanYouTubeUrl(query);
    return super.canHandle(cleaned);
  }

  override validate(url: string): boolean {
    const cleaned = cleanYouTubeUrl(url);
    return super.validate(cleaned);
  }

  override async search(query: string, requestedBy: string): Promise<SearchResult> {
    const cleaned = cleanYouTubeUrl(query);
    const result = await super.search(cleaned, requestedBy);
    if (result && result.tracks) {
      for (const track of result.tracks) {
        if (track.url) {
          track.url = cleanYouTubeUrl(track.url);
        }
      }
    }
    return result;
  }

  override async extractPlaylist(url: string, requestedBy: string): Promise<Track[]> {
    const cleaned = cleanYouTubeUrl(url);
    const tracks = await super.extractPlaylist(cleaned, requestedBy);
    if (tracks) {
      for (const track of tracks) {
        if (track.url) {
          track.url = cleanYouTubeUrl(track.url);
        }
      }
    }
    return tracks;
  }

  override async getStream(track: Track, signal?: AbortSignal): Promise<StreamInfo> {
    const cleanTrackUrl = track.url ? cleanYouTubeUrl(track.url) : track.url;
    const safeTrack: Track = {
      ...track,
      url: cleanTrackUrl,
    };

    // 1. Thử getStream của YouTubePlugin gốc trước (SABR / youtubei.js WebPO)
    try {
      const result = await super.getStream(safeTrack, signal);
      if (result && result.stream) {
        return result;
      }
    } catch (primaryErr: any) {
      console.warn(`[SafeYouTubePlugin] Luồng gốc thất bại cho "${track.title}": ${primaryErr?.message || primaryErr}. Thử luân phiên clients...`);
    }

    // 2. Thử luân phiên các client ít bị chặn của Innertube: IOS, ANDROID, TV_EMBEDDED, TV
    const id = track.id || (track.url ? extractYouTubeVideoId(track.url) : null);
    if (id) {
      await (this as any).ready;
      const yt = (this as any).client;
      if (yt) {
        const clientsToTry = ["IOS", "ANDROID", "TV_EMBEDDED", "TV"] as const;
        for (const clientName of clientsToTry) {
          try {
            console.log(`[SafeYouTubePlugin] Thử client ${clientName} cho track ID: ${id}`);
            const webStream = await yt.download(id, {
              type: "audio",
              quality: "best",
              client: clientName,
            });

            if (webStream) {
              const nodeStream = Readable.fromWeb(webStream as any);
              const passThrough = new PassThrough();
              nodeStream.pipe(passThrough);

              return {
                stream: passThrough,
                type: "arbitrary",
                metadata: {
                  ...track.metadata,
                  client: clientName,
                },
              };
            }
          } catch (clientError: any) {
            console.warn(`[SafeYouTubePlugin] Client ${clientName} thất bại: ${clientError?.message || clientError}`);
          }
        }
      }
    }

    // 3. Fallback sang SoundCloud bằng tiêu đề đã lấy từ YouTube oEmbed
    console.warn(`[SafeYouTubePlugin] Tất cả phương thức YouTube đều thất bại cho "${track.title}". Đang fallback sang SoundCloud qua oEmbed...`);
    try {
      let queryTitle = track.title;
      if (track.url) {
        const oembedTitle = await fetchYouTubeTitleViaOembed(track.url);
        if (oembedTitle) {
          queryTitle = oembedTitle;
        }
      }

      const manager = getManager();
      const scPlugin = ((manager as any)?.plugins as any[])?.find((p: any) => p.name === "soundcloud");
      if (scPlugin && queryTitle) {
        console.log(`[SafeYouTubePlugin] Tìm kiếm SoundCloud cho "${queryTitle}"...`);
        const scResult = await scPlugin.search(queryTitle, track.requestedBy || "auto");
        const scTrack = scResult?.tracks?.[0];
        if (scTrack) {
          console.log(`[SafeYouTubePlugin] Đã tìm thấy trên SoundCloud: "${scTrack.title}". Đang lấy stream...`);
          const scStream = await scPlugin.getStream(scTrack, signal);
          if (scStream && scStream.stream) {
            return scStream;
          }
        }
      }
    } catch (fallbackErr: any) {
      console.error(`[SafeYouTubePlugin] Fallback SoundCloud thất bại: ${fallbackErr?.message || fallbackErr}`);
    }

    throw new Error(`YouTube trích xuất thất bại cho "${track.title}" và fallback SoundCloud không khả dụng.`);
  }
}
