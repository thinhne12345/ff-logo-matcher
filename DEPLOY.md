# Tiếp tục triển khai FF Logo Matcher

## Bản cập nhật

- Nhập mật khẩu tại “Khung riêng của admin” để mở mẫu 01. Mã nguồn chỉ lưu bản băm scrypt có salt trong `private/admin-password.json`; máy chủ không phục vụ tệp này cho trình duyệt.
- Mật khẩu hoạt động ngay khi triển khai, không cần tạo GitHub OAuth app. Có thể ghi đè bản băm bằng biến môi trường `ADMIN_PASSWORD_HASH`, hoặc đặt biến này rỗng để tắt đăng nhập mật khẩu.
- Giới hạn 5 lần thử trong 15 phút trên mỗi địa chỉ kết nối; phiên hết hạn sau 8 giờ hoặc khi máy chủ khởi động lại. Sau proxy, nhiều người dùng có thể cùng chịu giới hạn này.
- GitHub là phương án tùy chọn, chỉ dành cho tài khoản có ID `130863341` (thinhne12345).
- Máy chủ kiểm tra phiên trước mỗi lần trả ảnh khung riêng.
- Logo gốc nằm trọn trong vòng tròn; preview và PNG/ZIP dùng cùng hàm ghép.
- Đăng xuất hủy phiên và xóa preview của khung riêng.

## GitHub và Render

1. Cập nhật các tệp trong gói lên repository `thinhne12345/ff-logo-matcher`, sau khi đối chiếu với phiên bản hiện tại trên GitHub. Bản local được lấy từ snapshot `2857edb`, không có lịch sử Git.
2. Chỉ nếu muốn đăng nhập GitHub, trong GitHub Settings → Developer settings → OAuth Apps, cấu hình ứng dụng đăng nhập:
   - Homepage URL: `https://ff-logo-matcher-1000.onrender.com`
   - Authorization callback URL: `https://ff-logo-matcher-1000.onrender.com/auth/github/callback`
3. Trong Environment của dịch vụ Render hiện tại, thêm:
   - `APP_ORIGIN=https://ff-logo-matcher-1000.onrender.com`
   - `GITHUB_CLIENT_ID`: Client ID của OAuth app (tùy chọn).
   - `GITHUB_CLIENT_SECRET`: Client Secret của OAuth app (tùy chọn).
   - `FRAME_ASSET_KEY`: giữ nguyên giá trị trong tệp `.env` local. Khóa này khớp với `private/frame-01.enc`; thay bằng khóa mới sẽ không giải mã được khung.
4. Giữ các biến môi trường đang dùng trên Render. Không đưa `.env` hoặc các khóa bí mật vào GitHub hay gói mã nguồn.
5. Deploy bản cập nhật và chờ dịch vụ hoạt động.

Nếu đổi domain, cập nhật `APP_ORIGIN`; nếu dùng OAuth thì cập nhật thêm homepage và callback URL. Không có OAuth vẫn đăng nhập được bằng mật khẩu.

## Kiểm tra sau triển khai

1. `GET /api/admin/session` khi chưa đăng nhập trả `admin: false`, `configured: true`.
2. `GET /api/admin/frame-01.png` khi chưa đăng nhập trả HTTP 403.
3. Nhập mật khẩu admin, kiểm tra mẫu 01 tự được chọn, tải logo và đối chiếu preview với PNG/ZIP.
4. Đăng xuất, kiểm tra mẫu riêng bị đóng và endpoint ảnh lại trả HTTP 403.
5. Các đường dẫn `/.env`, `/server.js`, `/private/frame-01.enc` trả HTTP 404.

Kiểm thử local: `npm test`. Các bài kiểm thử OAuth dùng phản hồi GitHub giả lập; vẫn cần kiểm tra đăng nhập thật trên Render.

## Chạy local

Đặt `APP_ORIGIN=http://localhost:3000`, chạy `npm start`, mở `http://localhost:3000` và đăng nhập bằng mật khẩu. Để thử GitHub local, dùng OAuth app riêng có callback `http://localhost:3000/auth/github/callback`.
