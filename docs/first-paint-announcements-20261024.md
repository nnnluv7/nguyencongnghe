# Giao diện khi tải trang và thông báo Admin — 24/10/2026

## Giao diện ban đầu

- Kiểm kê 113 trang hiện có; thêm trang quản lý thông báo thành 114 trang.
- Chuyển toàn bộ stylesheet thực của trang vào head, trước các script ngoài. Giữ thứ tự CSS nền/công cụ rồi đến Liquid Glass. Không thay đổi CSS nằm trong chuỗi JavaScript tạo bản in.
- Loại bỏ các khối trình bày Blogger đã bị chính nhãn của trang tắt (breadcrumb, thông tin đầu bài, chia sẻ, nội dung liên quan, tiêu đề trùng). Giữ dữ liệu và trường nhập của công cụ.
- Thay script cũ xử lý ẩn/hiện theo nhãn bằng HTML đã xử lý sẵn. Dịch nhãn và trạng thái widget in được giữ trong HTML.
- Bố cục kiểm quỹ, các khối thu gọn của editor và template Event/GVGS đã có ngay trong HTML, không đợi tải module/config mới biến đổi bố cục.
- Đồng bộ cấu hình nhúng với config chung mới nhất (16 công cụ). Theme dùng ngay cấu hình nhúng; bộ đếm truy cập hoạt động độc lập, không thể chặn giao diện.
- Đổi phiên bản URL CSS/theme/helper và yêu cầu trình duyệt/CDN kiểm tra lại tài nguyên. Không thêm màn hình che hay ẩn toàn trang để giấu quá trình tải.

## Thông báo

- Thanh Liquid Glass cao 38px, chuông đầu dòng, nút tạm dừng, hỗ trợ sáng/tối và reduced motion. Khoảng trống riêng phía trên header giữ nguyên bố cục công cụ. Không xuất hiện trong bản in.
- Dùng chung trên cả 114 trang, gồm game. Không có thông báo thì ẩn thanh và bỏ khoảng trống.
- Trang `/thong-bao/`: thêm, tải lại, xóa từng thông báo. Tối đa 10 thông báo, mỗi thông báo 500 ký tự. Có liên kết trong menu tài khoản sau kiểm tra Admin và trong hai ứng dụng Admin Event/GVGS.
- Dữ liệu lưu tại Netlify Blobs `ncn-site-announcements-v1`, độc lập bảng giá Event/GVGS. Khách chỉ đọc id/nội dung; không gửi thông tin tài khoản ra danh sách công khai.
- Quyền ghi được kiểm tra lại qua Identity `/user`, chỉ nhận vai trò Admin từ app_metadata. Kiểm tra Origin và ETag/version để hai phiên không ghi đè hoặc xóa nhầm thay đổi của nhau.
- Nội dung hiển thị bằng textContent, không thực thi HTML. Không lưu thông báo vào cache trình duyệt. Các trang đang mở kiểm tra lại mỗi 30 giây và khi quay lại tab.
- Bản mới không tạo thông báo mẫu trên website chính thức. Admin tự nhập nội dung cần đăng.

## Kiểm chứng

- 53/53 kiểm tra Node đạt: giữ 40 kiểm tra hiện có, thêm kiểm tra phân quyền/thêm/xóa/cạnh tranh dữ liệu và HTML ban đầu/cấu hình.
- Kiểm tra cú pháp các module mới và `git diff --check` đạt.
- Trình duyệt tải đủ 114/114 trang nguồn trên bản thử, iframe rộng 390px. Ghi nhận các frame đầu: CSS Liquid Glass đã áp dụng, bố cục kiểm quỹ đã thu gọn, không trang nào tràn ngang. Đây là kiểm tra kết xuất ban đầu, không thay thế thử mọi chức năng trên từng trang.
- Kiểm tra trực quan desktop và ba trang mobile: trang chủ, kiểm quỹ, quản lý thông báo. Thử thêm, tạm dừng, hủy xóa, xác nhận xóa cuối cùng và khôi phục vị trí header; dữ liệu thử được giữ riêng tại môi trường cục bộ.
- Kiểm quỹ: 2 tờ 500.000, ERP 1.200.000 cho thực tế 1.000.000 và chênh lệch +200.000. Chuyển sáng/tối hoạt động.
- Không đăng nhập Admin thật, không thêm/xóa dữ liệu thông báo hay bảng giá thật trong quá trình kiểm tra cục bộ.

Phần triển khai production và kiểm tra đường dẫn thật được xác nhận riêng sau khi gộp PR; kết quả cục bộ không tự chứng minh bản production đã triển khai.
