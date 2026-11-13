# Mẫu 02 — Khung đỏ bạc AF dành riêng cho admin

Đăng nhập ở “Khung riêng của admin”, sau đó chọn “Mẫu 02 · Khung đỏ bạc AF (Admin)” trong danh sách kiểu khung. Mẫu 01 vẫn được giữ nguyên.

Mẫu 02 dùng đúng ảnh PNG được cung cấp, giữ nền trong suốt. Logo được thu phóng giữ tỷ lệ, hiển thị đầy đủ ở vùng giữa dưới chữ AF; ảnh khung được vẽ bên trên logo. Preview, tải từng PNG và tải ZIP dùng chung hàm ghép, xuất 1000 × 1000 pixel. Khi tải ZIP, khung được lấy một lần cho mỗi lượt xuất.

Ảnh nằm trong `private/frame-02.png`. Chỉ endpoint `/api/admin/frame-02.png` trả ảnh khi phiên admin hợp lệ, với `Cache-Control: private, no-store`. Đường dẫn trực tiếp `/private/frame-02.png` không được phục vụ. Đăng xuất thu hồi quyền truy cập và bỏ cả hai lựa chọn khung riêng.

## Cập nhật dịch vụ Render hiện có

1. Cập nhật `server.js`, `app.js`, `admin-ui.js`, `index.html` và thêm `private/frame-02.png` vào mã nguồn của dịch vụ hiện tại. Đồng bộ thêm `tests/admin.test.js`, `tests/zip-export.test.js` và tài liệu này nếu muốn giữ kiểm thử.
2. Giữ các tệp private cũ và biến môi trường hiện có. Không cần đổi mật khẩu hoặc khóa mẫu 01.
3. Commit/push lên nhánh đang kết nối với Render rồi chạy deploy (hoặc chờ auto deploy).
4. Đăng nhập admin trên website, chọn mẫu 02, thử logo vuông/ngang/dọc, so sánh preview với PNG/ZIP. Đăng xuất và xác nhận cả hai mẫu riêng đã bị đóng.

## Kiểm tra bản mã nguồn

`npm test`: hai bộ kiểm thử màu khung/HEADPICS và 14 bài kiểm thử admin/ZIP đều đạt. Các bài mới kiểm tra quyền truy cập mẫu 02, thu hồi sau đăng xuất, giữ tỷ lệ và bố cục logo, thứ tự vẽ lớp khung và chọn đúng mẫu khi xuất ZIP.

Chưa kiểm tra giao diện bằng trình duyệt do công cụ trình duyệt không khả dụng trong phiên này. Gói này là bản cập nhật mã nguồn local; chưa triển khai lên website Render.
