# Donate và dùng thử VIP · 14/11/2026

Trang `/donate/#reg` có bảng quyền lợi, hướng dẫn, lựa chọn gói, QR theo đơn, kiểm tra trạng thái và lịch sử. Hai công cụ `/in-event/` và `/in-gvgs/` xuất hiện công khai trên trang chủ, menu và tìm kiếm. Các công cụ miễn phí khác giữ nguyên quyền sử dụng.

- Khách và tài khoản thường có **3 lượt chung**. Một lần tạo bản in thành công trừ một lượt; đọc danh sách, chọn sản phẩm, lỗi dữ liệu và gửi lại cùng request ID không trừ thêm.
- Khách được nhận diện bằng cookie ngẫu nhiên HttpOnly/Secure/SameSite=Lax; số lượt lưu ở Netlify Blobs. Khi đăng nhập, lượt khách được nhập vào tài khoản. Tài khoản giữ giới hạn khi đổi trình duyệt. Khách chưa xác thực không thể được nhận diện chắc chắn sau khi xóa cookie hoặc đổi thiết bị.
- `vip30`: 29.000đ/30 ngày. `vip60`: 49.000đ/60 ngày. Số gói từ 1–12; số tiền và ngày được tính phía máy chủ. Mỗi lần Donate thêm dùng một đơn mới.
- Ngày mới cộng từ `max(thời điểm ghi nhận, hạn VIP hiện tại)`. SePay gửi lặp hoặc hai thông báo dùng cùng tham chiếu ngân hàng không cộng ngày hai lần. Thanh toán sai số tiền/nội dung/hết thời hạn đưa vào đối chiếu.
- QR chỉ tạo sau đăng nhập và gắn với ID tài khoản đã xác nhận email. Quét QR hoặc bấm kiểm tra không tự cấp VIP. Hệ thống chỉ cấp sau thông báo ngân hàng được xác thực.
- Vai trò `admin` / `vip` cấp trực tiếp trong Netlify tiếp tục có hiệu lực. Thành viên thanh toán dùng ngày hết hạn trong `ncn-vip-payments-v1`; hết hạn quay về số lượt thử còn lại. Tạm khóa thành viên chặn cả lượt thử của tài khoản đó.

## Cấu hình production cần kiểm tra

- Netlify `NCN_PAYMENTS_ENABLED=true`.
- `SEPAY_WEBHOOK_SECRET`: secret HMAC hiện có, tối thiểu 32 ký tự. Không đưa giá trị secret vào mã nguồn.
- Webhook POST JSON: `https://nguyencongnghe.com/.netlify/functions/ncn-sepay-webhook`. SePay HMAC-SHA256 ký `timestamp.raw_body`, header `X-SePay-Timestamp` / `X-SePay-Signature`.
- Tài khoản nhận tiền giữ theo `BANK` trong `netlify/lib/ncn-billing-api.mjs`, dùng chung cơ chế nhận tiền đã có của website. Không lấy thông tin ngân hàng từ trang mẫu.
- Khi chưa sẵn sàng, API plans trả `enabled:false`, trang thông báo chờ kết nối và không tạo QR để nhận tiền.
- Netlify Deploy Preview tiếp tục không đọc/ghi dữ liệu VIP production. Bộ kiểm thử dùng Identity, ledger và webhook giả lập riêng.

## Kiểm tra

390 kiểm thử Node đạt. Bản dựng 123 trang qua kiểm tra tài nguyên, SRI và import map. Kiểm tra trực tiếp bản xem thử xác nhận tạo một bản in Event khiến Giờ vàng hiển thị 2/3 lượt; lựa chọn 2 gói 60 ngày hiển thị 98.000đ/120 ngày. Bộ trình duyệt kiểm tra QR thuộc đúng tài khoản, receipt giả lập có chữ ký, chuyển sang thành viên ủng hộ, giao diện 320/390/1440px và sáng/tối.
