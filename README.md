# VOLT Music Bot 🎵⚡

VOLT Music Bot là bot Discord nghe nhạc hiệu năng cao, xây dựng trên lõi `ziplayer` và `discord.js`, tối ưu hóa đặc biệt cho môi trường Render (Linux, 0.1 vCPU) và máy chủ cá nhân.

## ✨ Tính năng nổi bật
- **Prefix Commands:** Sử dụng toàn bộ hệ thống lệnh tiền tố `!` (`!play`, `!help`, `!skip`, `!stop`, `!pause`, `!resume`, `!loop`, `!queue`, `!shuffle`, `!volume`).
- **Giao diện trực quan:** Embed Now Playing kèm 4 nút bấm điều khiển trực tiếp (`Pause`, `Resume`, `Skip`, `Stop`) và Dropdown Menu (`Queue`, `Loop`, `Âm lượng`, `6 chế độ EQ`).
- **Bypass Chặn 403 & Timeout trên Render:** Tự động điều hướng các truy vấn Innertube YouTube sang `youtubei.googleapis.com` với Client Android chính thức.
- **Chống rè & vỡ tiếng:** Khóa trần âm lượng tối đa 100%, mặc định phát Inline Opus mộc sạch sẽ không qua FFmpeg.
- **Tự động rời phòng (Auto Leave):** Đếm ngược đúng 10 giây khi phòng thoại không còn người nghe.
- **Chống spam lệnh:** Cooldown 5 giây theo từng người dùng.
- **HTTP Keep-Alive Server:** Tích hợp sẵn web server trả HTTP 200 tại `/` và `/health` phục vụ giám sát uptime trên Render.

## 🚀 Hướng dẫn Cài đặt & Chạy cục bộ

```bash
# 1. Cài đặt thư viện
npm install

# 2. Tạo file cấu hình .env (tham khảo .env.example)
cp .env.example .env

# 3. Biên dịch TypeScript
npm run build

# 4. Khởi chạy bot
npm start
```

## 🌐 Deploy lên Render

1. Tạo Web Service mới kết nối với repository này.
2. Cấu hình môi trường:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. Thêm các biến môi trường (Environment Variables):
   - `DISCORD_TOKEN`: Token bot Discord
   - `CLIENT_ID`: ID ứng dụng Discord
   - `PORT`: 3000 (hoặc để Render tự cấp)
   - `PREFIX`: `!`
