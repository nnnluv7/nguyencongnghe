# Story thành viên và nội dung nổi bật

Thư viện `/thu-vien/` hiển thị 4 thẻ mỗi hàng trên máy tính, 2 trên máy tính bảng và thẻ ngang trên điện thoại. Mục **Nội dung nổi bật** nằm phía trên dãy **Story**, ngay trước thanh đếm và lọc nội dung. Bộ lọc, tổng số và phân trang vẫn dùng danh mục đang được công khai.

Admin mở bài trong `/admin/thu-vien/`, bật **Đưa vào nội dung nổi bật** rồi lưu. Website chọn tối đa 3 mục đang công khai, ưu tiên ngày đăng mới. Nếu chưa ghim mục nào, phần này giới thiệu 3 bài viết mới nhất. Bản nháp, mục ẩn và Thùng rác không được đưa lên đây.

## Đăng và quản lý ảnh

- Khách xem được ảnh công khai. Nút **Đăng Story** mở đăng nhập/đăng ký bằng tài khoản chung của website.
- Mọi tài khoản đã xác nhận email và đăng nhập đều đăng được ảnh; không cần VIP. Mỗi tài khoản có tối đa 5 lần đăng trong 24 giờ, kể cả ảnh đã xoá. Website giới hạn 200 ảnh đang lưu.
- Chọn JPEG, PNG hoặc WebP tối đa 10 MB, dưới 40 megapixel. Trình duyệt thu nhỏ trước khi gửi; máy chủ giới hạn 2 MB, giải mã, xoay đúng chiều, tạo lại JPEG tối đa 1920 px và ảnh nhỏ. Không lưu ảnh gốc, EXIF hoặc vị trí GPS.
- Tên hiển thị, ảnh, chú thích tối đa 180 ký tự và ngày đăng được công khai. Email không được xuất thành tên công khai.
- Story tự hết hạn sau 24 giờ kể từ lúc đăng, theo thời gian máy chủ. Ảnh hết hạn bị loại khỏi danh sách và không thể mở qua API, kể cả khi trình duyệt vẫn đang mở trang. Người đăng có thể xoá ảnh của mình; Admin có thể xoá mọi ảnh bằng nút trong trình xem, có bước xác nhận. Xoá gồm ảnh đầy đủ và ảnh nhỏ trong Netlify Blobs, không liên quan đến tệp mã nguồn trên GitHub.

## Vận hành

`ncn-stories` dùng kho `ncn-community-stories-v1`, đọc nhất quán mạnh và cập nhật chỉ mục có điều kiện. Tất cả thao tác ghi xác thực lại phiên Netlify Identity ở máy chủ, kiểm tra cùng nguồn và quyền sở hữu; hồ sơ lưu trên trình duyệt không cấp quyền. Ảnh tải lên có khoá bất biến, được ghi trước khi đưa vào danh sách. Request ID bảo vệ việc gửi lại khi mất phản hồi.

Thao tác xoá đánh dấu ẩn trước khi xoá dữ liệu. Nếu dịch vụ lưu trữ ngắt giữa chừng, chủ ảnh có thể bấm xoá lại; `ncn-stories-cleanup` chạy mỗi 5 phút ở production để hoàn tất. Tác vụ xoá ảnh đầy đủ và ảnh nhỏ đã hết hạn, mục đang xoá và ảnh mồ côi quá 24 giờ. Ảnh hết hạn ẩn đúng mốc 24 giờ; việc dọn byte lưu trữ được thực hiện ở lượt lịch kế tiếp. Marker tối thiểu ngăn phát lại một yêu cầu đăng đã xoá. Netlify cung cấp Sharp như dependency ngoài bundle.

Kiểm tra: `node --test tests/ncn-stories.test.mjs tests/ncn-library-admin.test.mjs` và `node tests/browser/ncn-stories.mjs`. Browser suite dùng Identity, ảnh và kho lưu trữ mô phỏng riêng, chạy giao diện và API thật, không ghi vào website production.
