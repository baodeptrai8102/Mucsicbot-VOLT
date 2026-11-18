# VOLT Music Bot - Render 0.1 vCPU Optimization & Bypass Worklist

## Quy tắc trạng thái
- [ ] = Chưa làm
- [x] = Đã xong và pass npm run build
- [!] = Lỗi sau 2 lần thử (ghi log và dừng)

## Danh sách Task
- [x] Task 1: Sửa triệt để RenderBypass 403 & Fetch Override trong `src/index.ts` | Yêu cầu: Bắt buộc xử lý cả 3 kiểu đầu vào `string`, `URL` và đối tượng `Request` của `fetch(input, init)`; viết lại URL chứa `www.youtube.com/youtubei/` hoặc `music.youtube.com/youtubei/` sang `youtubei.googleapis.com/youtubei/`; khi clone từ `Request`, tạo `Headers` mới và xóa `host` cũ; tự động gắn `process.env.YOUTUBE_COOKIE` nếu có; trên Render (`IS_RENDER`) hạ timeout xuống 4500ms để thất bại nhanh | Lệnh test: npm run build
- [x] Task 2: Tăng tốc độ lên nhạc trên Render & Fallback SoundCloud chống lỗi Error trong `src/commands/play.ts` và `src/events/playerEvents.ts` | Yêu cầu: Khi `IS_RENDER`: nếu tìm bằng từ khóa thì ưu tiên tìm qua SoundCloud trước, fallback YouTube nếu không có kết quả; nếu dán link YouTube và bị 403/playerError thì gọi YouTube oEmbed lấy tiêu đề rồi tự động phát qua SoundCloud (chống lặp trong `player.data`, tối đa 1 lần fallback/bài); khi `!IS_RENDER`: giữ nguyên ưu tiên YouTube | Lệnh test: npm run build
- [x] Task 3: Tối ưu 0.1 vCPU Render & Sửa Port KeepAlive trong `src/server.ts`, `src/config.ts`, `src/index.ts` | Yêu cầu: Bỏ `setTimeout` dư thừa sau `player.connect()`; tắt mặc định `player.queue.autoPlay(false)` ngăn gọi ngầm `/next`; giữ inline Opus gốc khi EQ tắt; trên Render chỉ nạp 3 plugin (SoundCloud, YouTube, Spotify), bỏ TTS và Attachments; giữ `chmodSync(0o755)` cho FFmpeg trên Linux; sửa `server.ts` bind `Number(process.env.PORT) || 10000` trên `0.0.0.0` để Render nhận port ngay | Lệnh test: npm run build
- [x] Task 4: Kiểm tra tích hợp & Build sạch 0 lỗi | Yêu cầu: Rà soát toàn bộ file đã sửa, giữ nguyên đầy đủ UI embed, 4 nút bấm, menu Dropdown EQ, lệnh prefix `!`, cooldown 5s, auto leave 10s; chạy `npm run build` đạt 0 lỗi | Lệnh test: npm run build

## Nhật ký dừng
- Chưa có lỗi.
