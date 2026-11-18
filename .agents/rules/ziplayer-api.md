---
trigger: glob
globs: "src/**/*.ts"
description: Chuẩn Public API của thư viện ziplayer cho bot nhạc
---

# ZiPlayer Public API (Bản rút gọn)

## Khởi tạo Singleton
- Yêu cầu Node.js >= 20.3. Khởi tạo `new PlayerManager({ plugins, autoCleanup: true })` đúng 1 lần trong file khởi chạy chính.
- Trong mọi file lệnh và sự kiện, chỉ lấy lại bằng `getManager()` và `getPlayer(guildId)`. Không tạo `PlayerManager` mới theo từng guild và không gắn vào Discord client.
- Khi `getPlayer(guildId)` trả về `undefined`, tạo bằng `await manager.create(guildId, options)`.

## Điều khiển phát nhạc & Âm thanh chống rè
- Mọi thao tác đều bất đồng bộ, bắt buộc `await` và kiểm tra kết quả `false` hoặc bắt ngoại lệ: `player.connect(voiceChannel)`, `player.play(query, { requestedBy })`, `player.insert(query, index, userId)`, `player.pause()`, `player.resume()`, `player.skip()`, `player.previous()`, `player.seek(ms)`, `player.stop()`, `player.destroy()`.
- `player.setVolume(value)` chỉ đặt mặc định 80 và giới hạn tối đa 100 để tránh vỡ tiếng.
- Đường phát inline Opus volume không cần FFmpeg; mặc định tắt toàn bộ EQ/filter, chỉ bật khi người dùng chủ động chọn trong menu.

## Hàng đợi & Sự kiện
- Đọc đồng bộ: `player.currentTrack`, `player.connection`, `player.isPlaying`, `player.isPaused`, `player.isIdle`, `player.volume`, `player.queue`.
- Thao tác queue: `player.queue.add(track)` chỉ nhận `Track` đã resolve (không truyền chuỗi tìm kiếm thô), `remove(i)`, `move(from, to)`, `shuffle()`, `clear()`, `loop("off" | "track" | "queue")`, `autoPlay(bool)`.
- Dữ liệu riêng của guild lưu trong `player.data` (không đụng các key bắt đầu bằng `@ziplayer/`).
- Đăng ký sự kiện qua `manager.on()`: `trackStart`, `trackEnd`, `queueEnd`, `playerError`, `connectionError`, `queueAdd`, `queueAddList`, `playerPause`, `playerResume`, `playerDestroy`.
- Tuyệt đối không dùng `Bus`, controller nội bộ hay chạy lệnh build/test của thư mục `core/`.