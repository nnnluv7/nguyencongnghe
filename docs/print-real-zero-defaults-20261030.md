# Giá trị số thật trong mẫu in — 30/10/2026

Theo yêu cầu chủ website, các dãy số 0 trên mẫu là nội dung thật để đặt con trỏ, chọn một đoạn và sửa từng số. Tên sản phẩm tiếp tục để trống và hiển thị gợi ý như giao diện đã duyệt.

- 49 ô trong 27 bố cục Sticker và 82 ô trong 31 bố cục Popup được chuyển từ gợi ý sang giá trị khởi tạo thật. Giữ nguyên chuỗi số, dấu phân cách, tiền tệ, tỷ lệ và mẫu thời gian của từng ô.
- Xóa hết một giá trị sẽ để ô trống; không hiện lại dãy số 0 giả. Ô số có nhãn truy cập và không bị gạch kiểm tra chính tả trong bản xem trước.
- Thanh chỉnh nội dung và giấy xem trước dùng chung giá trị. Sửa riêng một nhãn, áp dụng cả nhóm, giá trị nhập từ tệp và giá trị 0 có chủ ý tiếp tục được giữ riêng biệt.
- Kiểm tra trước khi xuất nhận biết các bản chưa sửa bằng giá trị khởi tạo, kể cả dãy số 0 thật. Các bản đã sửa nhưng thiếu thông tin bắt buộc vẫn bị chặn.
- Không thay giao diện Liquid Glass, CSS/hình/phông chữ/kích thước hay HTML mẫu giấy. Đã đối chiếu cả 112 bố cục, 217 tài nguyên và 17 vùng in cũ. Mẫu Phone cũ đã dùng giá trị số thật nên giữ nguyên. FIFO và giá sản phẩm Event/GVGS giữ nguyên.

## Kiểm chứng

- 321 kiểm thử Node đạt; kiểm tra bản dựng đạt trên 123 trang và tài nguyên có hash/SRI.
- Kiểm thử Chromium xác nhận 131 giá trị thật trong đủ 58 bố cục. Bản dựng thực tế ở 1280px/390px kiểm tra sửa một chữ số, giữ con trỏ, tên sản phẩm gợi ý, xóa giá trị, tách nhãn, áp dụng nhóm và tải HTML chứa dữ liệu cùng hình/phông chữ nhúng.
- 136 bản Sticker/Popup ở A4/A5 qua kiểm tra chữ trong khung. Kiểm tra hình học mở rộng tại môi trường cục bộ vẫn báo tám trường hợp của hai biểu mẫu bán hàng; chạy lại ở checkout main `0733365` có đúng cùng tám kết quả. Các biểu mẫu đó không thay đổi trong bản sửa này.
- Chỉ cập nhật hash của bộ điều khiển xem trước dùng chung trong baseline vì thay đổi thuộc tính nhập và nhận biết giá trị mặc định. Hash của sáu bộ dựng giấy còn lại và toàn bộ vùng in cũ giữ nguyên.

CI bổ sung kiểm thử giá trị thật trên bản dựng đã tối ưu; mở rộng điều kiện chạy tới mã điều khiển in dùng chung.
