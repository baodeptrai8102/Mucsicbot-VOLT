# VOLT Music Bot - Complete Full Build Automation (Prefix Commands: !)

## Quy tắc trạng thái
- [ ] = Chưa làm
- [x] = Đã xong và pass npm run build
- [!] = Lỗi sau 2 lần thử (ghi log và bỏ qua)

## Giai đoạn 1: Khung bot cơ bản
- [x] Task 1: Thiết lập cấu hình toàn cục `config.ts` và HTTP keep-alive server `server.ts`.
- [x] Task 2: Xây dựng hệ thống UI giao diện `playerUi.ts` (Embed, 4 Nút trực tiếp: Pause/Resume/Skip/Stop, Menu Dropdown: Queue, Loop, Âm lượng 100%, 6 chế độ EQ).
- [x] Task 3: Xây dựng lệnh phát nhạc `play.ts` dùng prefix `!play`, chuẩn singleton `ziplayer` (`getManager`, `getPlayer`), hỗ trợ YouTube, SoundCloud, Spotify.
- [x] Task 4: Xây dựng lệnh hướng dẫn `help.ts` dùng prefix `!help` hiển thị thông tin chi tiết và nút liên kết mời bot (`ButtonStyle.Link`).
- [x] Task 5: Xây dựng bộ quản lý sự kiện tương tác `interactionCreate.ts` để xử lý 4 nút bấm trực tiếp và Menu Dropdown đa năng.
- [x] Task 6: Xây dựng bộ quản lý sự kiện kênh thoại `voiceStateUpdate.ts` tự động rời phòng sau ĐÚNG 10 GIÂY khi không còn người nghe.
- [x] Task 7: Xây dựng sự kiện phát nhạc `playerEvents.ts` tự động gửi thông báo Now Playing kèm giao diện điều khiển.
- [x] Task 8: Xây dựng file khởi chạy chính `index.ts` tích hợp `ffmpeg-static`, bộ override `globalThis.fetch` chống lỗi 403/Timeout trên Render, bộ chống sập toàn cục và khởi tạo PlayerManager singleton.

## Giai đoạn 2: Chống rè, nhạc dài 10+ phút đúng bài, out chuẩn 10s & tối ưu Render
- [x] Task 9: Chuẩn hóa khởi tạo `PlayerManager` và `globalThis.fetch` trong `src/index.ts` | Yêu cầu: Đặt `YouTubePlugin` ưu tiên đầu tiên trước `SoundCloudPlugin` và `SpotifyPlugin` (truyền cookie YouTube từ `process.env.YOUTUBE_COOKIE` nếu plugin hỗ trợ); chỉ gắn timeout 12s cho request tìm kiếm/metadata và tuyệt đối KHÔNG áp timeout lên stream audio dài; thiết lập đường dẫn `ffmpeg-static`; bắt `unhandledRejection` và `uncaughtException` | Lệnh test: npm run build
- [x] Task 10: Chống sai bài và đứt gãy cho nhạc dài 10+ phút trong `src/commands/play.ts` | Yêu cầu: Kiểm tra kỹ `await player.connect()` và `await player.play()`, xử lý khi trả về `false`; khi nhập link trực tiếp thì giữ nguyên URL không tự tìm lại; khi nhập tên bài thì ưu tiên kết quả khớp trên YouTube và chặn rơi nhầm sang bản cover/short sai bài | Lệnh test: npm run build
- [x] Task 11: Chống rè và vỡ tiếng trong `src/ui/playerUi.ts` và `src/events/interactionCreate.ts` | Yêu cầu: Đặt âm lượng mặc định 80 và khóa trần tối đa 100; mặc định tắt toàn bộ filter/EQ để phát bằng inline Opus không qua FFmpeg, chỉ kích hoạt FFmpeg khi người dùng chọn EQ trong dropdown và có tùy chọn tắt EQ về mặc định ngay | Lệnh test: npm run build
- [x] Task 12: Khóa chính xác bộ đếm rời phòng 10 giây trong `src/events/voiceStateUpdate.ts` và `src/commands/play.ts` | Yêu cầu: Đặt `leaveOnEmpty: false` trong `manager.create()` để tránh đụng bộ đếm nội bộ của `ziplayer`; dùng một `Map<string, NodeJS.Timeout>` theo `guildId` đếm đúng 10000ms khi phòng còn 0 thành viên thật (bỏ qua bot), hủy timer ngay nếu có người vào lại, hết 10s gọi `await player.destroy()` và dọn timer khi gặp sự kiện `playerDestroy` | Lệnh test: npm run build
- [x] Task 13: Hoàn thiện xử lý lỗi luồng phát trong `src/events/playerEvents.ts` | Yêu cầu: Lắng nghe đủ `trackStart`, `trackEnd`, `queueEnd`, `playerError`, `connectionError`, `playerDestroy` qua `manager.on()`; khi xảy ra lỗi thì ghi log ngắn gọn (guildId, tên bài, mã lỗi) và báo rõ cho người dùng, tránh kẹt queue | Lệnh test: npm run build
- [x] Task 14: Chuẩn hóa chạy production trên Render trong `src/server.ts`, `package.json` và `tsconfig.json` | Yêu cầu: `server.ts` lắng nghe đúng `Number(process.env.PORT) || 3000` trên `0.0.0.0` và trả HTTP 200 tại `/` và `/health`; `package.json` đặt `"engines": { "node": ">=20.18.0" }`, script `build` biên dịch sạch sang thư mục `dist` và `start` chạy `node dist/index.js` | Lệnh test: npm run build

## Nhật ký dừng
- Chưa có lỗi.