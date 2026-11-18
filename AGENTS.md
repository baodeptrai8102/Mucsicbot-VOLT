# Luật cốt lõi — VOLT Music Bot
- Chỉ đọc và chỉnh sửa đúng file được nêu trong task hoặc tag bằng @filename. Không tự quét toàn bộ dự án.
- Đọc đoạn code hiện có trước khi sửa; tuyệt đối không đoán tên hàm, đường dẫn import hay kiểu dữ liệu.
- Zero-regression: Chỉ chỉnh đúng phần liên quan, không xóa hoặc viết lại logic cũ đang chạy ổn.
- Giữ nguyên hệ thống lệnh prefix `!`, không đổi sang slash command.
- Phanh chống vòng lặp: Nếu sửa cùng 1 lỗi hoặc chạy build thất bại 2 lần liên tiếp, DỪNG NGAY, ghi nguyên nhân gốc và báo cáo.
- Báo cáo sau mỗi lượt tối đa 5 dòng, không giải thích dài dòng.