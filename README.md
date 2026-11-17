# ⚡ VOLT MUSIC - High-Performance Discord Music Bot

Bot nhạc Discord TypeScript chuẩn kiến trúc **ZiPlayer** tối ưu hóa chuyên biệt cho **Render Free Tier (0.1 vCPU, 512MB RAM)**.

---

## 🌟 Tính Năng Nổi Bật

- 🚀 **Render 0.1 vCPU Survival**: Thiết lập đường dẫn `FFMPEG_PATH` tĩnh qua `ffmpeg-static` ngay từ dòng đầu tiên, stream audio Opus trực tiếp chống giật lag và tối ưu CPU tối đa.
- 🛡️ **Anti-Timeout & Anti-Crash**:
  - Tự động phản hồi tin nhắn chờ ngay trên dòng đầu tiên của lệnh `!` để bảo vệ timeout.
  - Phản hồi `deferReply({ flags: MessageFlags.Ephemeral })` tức thì trong `interactionCreate` để loại bỏ hoàn toàn lỗi `10062: Unknown interaction`.
  - Giới hạn tìm kiếm trong `Promise.race` (20 giây) thông báo lỗi thân thiện khi YouTube bị nghẽn mạng thay vì treo bot.
- 🎯 **100% Prefix Commands (`!`)**: Hoạt động hoàn toàn bằng tiền tố `!`, không sử dụng Slash commands.
- 🎛️ **Bảng Điều Khiển Tương Tác Trực Quan**:
  - Giao diện phát nhạc với Embed Neon Green (`#00FF66`).
  - Hàng nút bấm: `Pause` (Secondary), `Resume` (Success), `Skip` (Primary), `Stop` (Danger).
  - Thanh chọn thả xuống (Select Menu): Trộn bài (Shuffle), Lặp lại 1 bài (Loop Track), Lặp lại hàng chờ (Loop Queue), Tắt lặp lại (Loop Off), Bật/Tắt AutoPlay.
- 🌐 **Web Keep-Alive Server**: Tích hợp Express server lắng nghe cổng `process.env.PORT || 3000` giúp Render Web Service không bị lỗi port binding hoặc tắt ứng dụng khi phát nhạc.

---

## 📋 Danh Sách Lệnh Tiền Tố (`!`)

| Lệnh | Viết tắt | Mô tả |
| :--- | :--- | :--- |
| `!play <tên bài/link>` | `!p` | Phát nhạc hoặc xếp bài hát vào hàng chờ |
| `!pause` | - | Tạm dừng phát bài hát |
| `!resume` | - | Tiếp tục phát bài hát đang tạm dừng |
| `!skip` | `!s` | Bỏ qua bài hát hiện tại |
| `!stop` | - | Dừng phát nhạc, xóa hàng chờ và rời kênh thoại |
| `!queue` | `!q` | Xem danh sách bài hát đang phát và hàng chờ |
| `!nowplaying` | `!np` | Xem bài hát đang phát và mở bảng điều khiển |
| `!shuffle` | - | Xáo trộn ngẫu nhiên danh sách phát |
| `!loop <off\|track\|queue>` | - | Đổi chế độ lặp lại |
| `!autoplay` | - | Bật / Tắt tính năng tự động tìm bài tương tự |
| `!volume <0-200>` | `!vol` | Điều chỉnh âm lượng phát nhạc (mặc định 80%) |
| `!help` | `!h` | Hiển thị bảng hướng dẫn lệnh |

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy

### 1. Cài đặt biến môi trường
Tạo file `.env` từ `.env.example`:
```env
DISCORD_TOKEN=your_bot_token_here
PREFIX=!
PORT=3000
```

### 2. Biên dịch & Chạy mã nguồn
```bash
# Cài đặt thư viện
npm install

# Biên dịch TypeScript sang JavaScript
npm run build

# Khởi động Bot
npm start
```

### 3. Deploy lên Render (Web Service)
1. **Build Command**: `npm install && npm run build`
2. **Start Command**: `npm start`
3. **Environment Variables**:
   - `DISCORD_TOKEN`: Token bot Discord của bạn.
   - `PREFIX`: `!`
