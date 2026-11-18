# VOLT Music Bot - YouTube Priority & Stream Pipeline Overhaul

## Quy tắc trạng thái
- [ ] = Chưa làm
- [x] = Đã xong và pass npm run build
- [!] = Lỗi sau 2 lần thử (ghi log và dừng)

## Danh sách Task
- [x] Task 1: Ưu tiên YouTube làm nguồn số 1 & Sửa triệt để lỗi 403 / Timeout trên Render | Yêu cầu: Khôi phục YouTube số 1 trên cả Render và VS Code; chuẩn hóa link xóa sạch ?si=...; tăng timeout fetch lên 10000ms, xử lý đủ 3 kiểu string/URL/Request, rewrite sang youtubei.googleapis.com, tự gắn Cookie; tạo SafeYouTubePlugin thử luân phiên clients (IOS, ANDROID, TV_EMBEDDED...) và chỉ fallback SoundCloud khi YouTube không thể trích xuất | Lệnh test: npm run build
- [x] Task 2: Soi gốc và diệt tận gốc lỗi `The _write() method is not implemented` trong SoundCloudPlugin và ziplayer stream | Yêu cầu: Đọc trực tiếp node_modules/@ziplayer/plugin/dist/SoundCloudPlugin.js và ziplayer/dist/index.js; tạo SafeSoundCloudPlugin đảm bảo getStream() luôn trả về Node.js Readable / PassThrough stream hợp lệ, không bao giờ thiếu _write(); kiểm tra tương thích Node 20+ | Lệnh test: npm run build
- [x] Task 3: Dọn lỗi lặp queueEnd, dọn log FFmpeg & Tối ưu 0.1 vCPU | Yêu cầu: Debounce queueEnd trong 3000ms theo guildId chống gửi lặp 2 tin nhắn; log error?.stack đầy đủ khi có playerError/connectionError; chỉ chmodSync FFmpeg đúng 1 lần không in log lặp; tắt autoPlay(false); giữ inline Opus khi EQ tắt | Lệnh test: npm run build
- [x] Task 4: Chạy test stream thực tế & Build sạch 0 lỗi | Yêu cầu: Chạy script test npx tsx đọc ít nhất 16KB dữ liệu âm thanh thật từ cả YouTube và SoundCloud, xác nhận không còn lỗi _write() hay timeout, sau đó xóa file test; chạy npm run build đạt 0 lỗi; báo cáo nguyên nhân gốc lỗi _write() | Lệnh test: npm run build

## Nhật ký dừng
- Chưa có lỗi.
