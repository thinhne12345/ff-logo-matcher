# Tăng tốc xuất ZIP cho FF Logo Matcher

Bản này dành cho công cụ ghép logo tại https://ff-logo-matcher-1000.onrender.com/ có nút “Tải ZIP”.

- Tải và giải mã ảnh khung admin một lần cho mỗi lượt ZIP, dùng lại trong lượt đó.
- Tạo tối đa ba PNG cùng lúc, giữ thứ tự và tên HEADPICS ID trong ZIP.
- Preview admin cũng tải khung một lần cho mỗi lượt dựng preview.
- Hiển thị số PNG đã xong và bước đóng gói; chỉ báo 100% khi ZIP đã được tạo.
- Khi một ảnh lỗi, chờ các tác vụ đang chạy kết thúc, không tải ZIP thiếu ảnh và cho phép thử lại.

Thay `app.js` và `admin-ui.js` trong dự án FF Logo Matcher tương ứng. `package.json` và `tests/zip-export.test.js` cập nhật bộ kiểm thử. Không cần đổi ảnh khung, mật khẩu, cấu hình server hay các tệp private.

Kiểm tra: `npm test` đã qua kiểm thử màu khung, HEADPICS và 11 bài kiểm thử admin/ZIP. Kiểm thử ZIP xác minh nội dung, CRC, thứ tự ID, giới hạn ba tác vụ, một yêu cầu khung mỗi lượt, trường hợp lỗi và thử lại. Chưa đo thời gian thực tế trên điện thoại hoặc triển khai lên trang công khai.

ZIP được tạo ngay trong trình duyệt từ logo người dùng tải lên. Thời gian chờ ở nút ZIP chủ yếu là dựng/ghi PNG, không phải truyền ZIP từ server. Mức cải thiện phụ thuộc thiết bị, kích thước logo và độ trễ tải khung.
