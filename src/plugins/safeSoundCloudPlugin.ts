import { SoundCloudPlugin } from "@ziplayer/plugin";
import { Readable, PassThrough } from "node:stream";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { StreamType } from "@discordjs/voice";
import type { Track, StreamInfo } from "ziplayer";
import ffmpegPath from "ffmpeg-static";

/**
 * Lấy đường dẫn executable của FFmpeg tương thích với Windows, Linux (Render) và container.
 */
function getFFmpegExecutable(): string {
  const candidates = [
    process.env.FFMPEG_PATH,
    typeof ffmpegPath === "string" ? ffmpegPath : (ffmpegPath as any)?.default,
    "ffmpeg",
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "string") {
      if (candidate === "ffmpeg") return candidate;
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {}
    }
  }

  return "ffmpeg";
}

/**
 * Chuyển đổi an toàn bất kỳ luồng dữ liệu nào (WebStream, Node Readable, Buffer stream)
 * thành một Node.js PassThrough stream chuẩn 100%, bảo đảm không bao giờ thiếu _write().
 *
 * Nguyên nhân gốc của ERR_METHOD_NOT_IMPLEMENTED (_write):
 * Khi thư viện âm thanh hoặc @discordjs/voice kết nối luồng qua pipe/pipeline,
 * nếu stream đầu vào là một Readable đơn thuần hoặc stream thiếu cài đặt _write,
 * Node.js Stream Writable internals sẽ ném lỗi: "The _write() method is not implemented".
 * Bằng cách bọc qua PassThrough (vốn kế thừa Transform với _write và _transform đầy đủ),
 * luồng dữ liệu trở thành luồng hai chiều an toàn tuyệt đối.
 */
export function toSafePassThrough(rawStream: any, signal?: AbortSignal): PassThrough {
  const passThrough = new PassThrough();

  // Đảm bảo passThrough luôn có _write hợp lệ kể cả khi bị monkey-patch trong runtime
  if (typeof (passThrough as any)._write !== "function") {
    (passThrough as any)._write = function (
      chunk: any,
      encoding: BufferEncoding,
      callback: (error?: Error | null) => void
    ) {
      passThrough.push(chunk, encoding);
      callback();
    };
  }

  if (signal) {
    if (signal.aborted) {
      passThrough.destroy(new Error("SoundCloud stream aborted"));
      if (rawStream && typeof rawStream.destroy === "function") {
        try {
          rawStream.destroy();
        } catch {}
      }
      return passThrough;
    }

    const onAbort = () => {
      passThrough.destroy(new Error("SoundCloud stream aborted"));
      if (rawStream && typeof rawStream.destroy === "function") {
        try {
          rawStream.destroy();
        } catch {}
      }
    };

    signal.addEventListener("abort", onAbort, { once: true });
    passThrough.once("close", () => {
      signal.removeEventListener("abort", onAbort);
    });
  }

  if (!rawStream) {
    passThrough.destroy(new Error("SoundCloud rawStream is null or undefined"));
    return passThrough;
  }

  // 1. Trường hợp rawStream là Node.js Readable stream thông thường
  if (typeof rawStream.pipe === "function") {
    rawStream.pipe(passThrough);

    if (typeof rawStream.on === "function") {
      rawStream.on("error", (err: any) => {
        if (!passThrough.destroyed) {
          passThrough.destroy(err);
        }
      });
    }

    passThrough.once("close", () => {
      if (rawStream && !rawStream.destroyed && typeof rawStream.destroy === "function") {
        try {
          rawStream.destroy();
        } catch {}
      }
    });

    return passThrough;
  }

  // 2. Trường hợp rawStream là WHATWG ReadableStream (WebStream) hoặc AsyncIterable
  try {
    let nodeReadable: Readable;
    if (typeof (Readable as any).fromWeb === "function" && typeof rawStream.getReader === "function") {
      nodeReadable = (Readable as any).fromWeb(rawStream);
    } else if (typeof (Readable as any).from === "function") {
      nodeReadable = Readable.from(rawStream);
    } else {
      throw new Error("Cannot convert rawStream to Node.js Readable");
    }

    nodeReadable.pipe(passThrough);

    nodeReadable.on("error", (err: any) => {
      if (!passThrough.destroyed) {
        passThrough.destroy(err);
      }
    });

    passThrough.once("close", () => {
      if (!nodeReadable.destroyed && typeof nodeReadable.destroy === "function") {
        try {
          nodeReadable.destroy();
        } catch {}
      }
    });

    return passThrough;
  } catch (convErr: any) {
    passThrough.destroy(new Error(`Failed to wrap SoundCloud stream: ${convErr?.message || convErr}`));
    return passThrough;
  }
}

/**
 * Transcode luồng audio qua FFmpeg-Static thành PCM s16le nếu luồng gốc bị lỗi codec
 */
export function transcodeWithFFmpeg(
  input: Readable | string,
  signal?: AbortSignal
): PassThrough {
  const output = new PassThrough();
  const ffmpegBin = getFFmpegExecutable();

  const isString = typeof input === "string";
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    isString ? input : "pipe:0",
    "-f",
    "s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "pipe:1",
  ];

  const proc = spawn(ffmpegBin, args, {
    stdio: [isString ? "ignore" : "pipe", "pipe", "ignore"],
    windowsHide: true,
  });

  if (!isString && proc.stdin) {
    (input as Readable).pipe(proc.stdin);
    (input as Readable).on("error", () => {
      try {
        proc.stdin?.destroy();
      } catch {}
    });
  }

  if (proc.stdout) {
    proc.stdout.pipe(output);
  } else {
    output.destroy(new Error("FFmpeg stdout is unavailable"));
    return output;
  }

  const cleanup = () => {
    try {
      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill("SIGKILL");
      }
    } catch {}
  };

  proc.once("error", (err) => {
    if (!output.destroyed) {
      output.destroy(err);
    }
    cleanup();
  });

  proc.once("close", () => {
    cleanup();
  });

  output.once("close", () => {
    cleanup();
  });

  if (signal) {
    if (signal.aborted) {
      cleanup();
      output.destroy(new Error("Aborted"));
    } else {
      signal.addEventListener("abort", () => {
        cleanup();
        output.destroy(new Error("Aborted"));
      }, { once: true });
    }
  }

  return output;
}

/**
 * SafeSoundCloudPlugin:
 * Bọc và kế thừa SoundCloudPlugin của @ziplayer/plugin.
 * Diệt tận gốc lỗi ERR_METHOD_NOT_IMPLEMENTED (_write) bằng cách đảm bảo hàm getStream(track)
 * LUÔN trả về một Node.js PassThrough stream sạch sẽ, hợp lệ 100%, có hỗ trợ recreate() khi seek.
 */
export class SafeSoundCloudPlugin extends SoundCloudPlugin {
  constructor() {
    super();
    this.name = "soundcloud";
  }

  override async getStream(track: Track, signal?: AbortSignal): Promise<StreamInfo> {
    await (this as any).ready;

    let rawStream: any = null;

    // 1. Thử tải stream trực tiếp từ URL của track
    try {
      if (track.url) {
        rawStream = await (this as any).client.downloadTrack(track.url, { signal });
      }
    } catch (err: any) {
      console.warn(`[SafeSoundCloudPlugin] Tải trực tiếp URL thất bại cho "${track.title}": ${err?.message || err}`);
    }

    // 2. Nếu không được hoặc stream null, thử qua getFallback (tìm kiếm theo tiêu đề)
    if (!rawStream && track.title) {
      try {
        console.log(`[SafeSoundCloudPlugin] Thử fallback tìm kiếm SoundCloud cho "${track.title}"...`);
        const fallbackInfo = await super.getFallback(track);
        if (fallbackInfo && fallbackInfo.stream) {
          rawStream = fallbackInfo.stream;
        }
      } catch (fbErr: any) {
        console.warn(`[SafeSoundCloudPlugin] Fallback tìm kiếm thất bại cho "${track.title}": ${fbErr?.message || fbErr}`);
      }
    }

    if (!rawStream) {
      throw new Error(`SoundCloud không thể trích xuất audio stream cho bài: "${track.title}"`);
    }

    // 3. Chuẩn hóa rawStream thành Node.js PassThrough stream an toàn 100%
    const safeStream = toSafePassThrough(rawStream, signal);

    return {
      stream: safeStream,
      type: "arbitrary",
      inputType: StreamType.Arbitrary,
      metadata: track.metadata,
      recreate: async (position: number) => {
        try {
          const recreated = await (this as any).client.downloadTrack(track.url, {
            seek: position,
            signal,
          });
          return toSafePassThrough(recreated, signal);
        } catch {
          return toSafePassThrough(null, signal);
        }
      },
    };
  }
}

