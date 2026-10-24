# Đồng bộ phần bên trong bảy công cụ — 24/10/2026

Phạm vi: bán hàng, tạo QR, kiểm kê Excel, FIFO, tư vấn bảo hiểm/trả chậm, vòng quay và game chim bay. Giữ theme Liquid Glass hiện có, bảng giá, nội dung thông báo và quyền truy cập.

## Nguyên nhân và sửa đổi

- Bốn công cụ cũ vẫn có form, viền bảng, font và khối Blogger riêng. Thêm CSS theo trang và HTML form Liquid Glass ngay trong head/body ban đầu; bỏ tiêu đề/chia sẻ/bình luận Blogger thừa ở đúng những trang này. Các trang khác giữ nguyên.
- QR và kiểm kê dùng panel kính, trường nhập/nút thống nhất và khung QR nền trắng để dễ quét. Kiểm kê giữ nguyên xử lý Excel và các ID điều khiển, sửa cả nhãn CSS cũ của bộ đếm để không chồng chữ.
- FIFO có bảng nhập cuộn riêng và khung xem trước đã nằm sẵn trong HTML. Mobile helper tái sử dụng các wrapper thay vì tạo lại khi tải xong. Nội dung 48 nhãn in và thuật toán sinh nhãn giữ nguyên; phần kính chỉ áp dụng cho màn hình.
- Tư vấn dùng hai panel kính, các lựa chọn bảo hiểm và nhóm trường đơn vị nhập được thu gọn. Toàn bộ ID, dữ liệu và JavaScript tính toán hiện có giữ nguyên. CSS ẩn đúng các nhóm chưa chọn ngay từ frame đầu, không đợi JavaScript ẩn bảng cũ.
- Vòng quay từng chứa SVG màu đậm cũ trong HTML rồi mới thay bằng gradient khi module chạy. HTML ban đầu nay dùng đúng tám gradient của renderer; nút Xóa đã ở đúng vị trí ngay trong markup, bỏ thao tác di chuyển bố cục khi khởi tạo.
- Menu game vốn là phần tử con của header nhưng lại nhận thêm offset thông báo lần thứ hai. Menu nay là thành phần trong hàng flex của header, margin bằng 0; thanh thông báo chỉ dịch header một lần. Xóa các khối CSS bố cục game v2/v3 chồng nhau. Logo và menu đủ 18 mục/icon có sẵn ngay trong HTML, dùng config nhúng mới nhất, không đổi từ logo/menu dự phòng sang giao diện khác sau fetch. Giữ liên kết Admin trong menu khi khởi tạo.
- Đổi phiên bản URL CSS/helper/module liên quan để trình duyệt lấy đúng bản mới.

## Kiểm chứng

- 58/58 kiểm tra Node đạt, gồm 53 kiểm tra trước và 5 kiểm tra giao diện ban đầu, gradient vòng quay, hợp đồng các ID, config game, độ nguyên vẹn nhãn in.
- Hash HTML `#printMe` FIFO trước/sau giống nhau: `2c474a9253357d03984e85569275fbc01dd74e708b52755322519fd9b784628f` (48 nhãn).
- Kiểm tra trực quan bảy công cụ ở desktop và mobile; 7/7 trang không tràn ngang ở iframe 360px (345px phần nội dung sau scrollbar).
- Game: Menu và header có cùng tâm dọc (chênh 0px) ở desktop và 390px khi có thông báo; desktop khi không có thông báo cũng 0px. Mở/đóng menu hoạt động, đủ 18 icon điều hướng. Engine/đồ họa trò chơi giữ nguyên.
- QR: nhập chuỗi thử và bấm Tạo mã QR làm đổi hình mã. Kiểm kê: chọn file Excel thật chứa `001234` và `SP-002`, tạo mã/đọc đúng tên/số lượng, giữ số 0 đầu, chuyển sản phẩm được.
- FIFO: nhập phiên bản `128GB`, số lượng 2, nhãn có đúng ngày/màu/phiên bản; khung xem trước tự co vừa màn hình. Tư vấn: giá bán 10.000.000, trả trước 30%, Home Credit, 6 tháng, lãi suất 0 cho kết quả cũ 1.178.000/tháng. Không thay đổi công thức.
- Quay thử bằng tên giả lập hoàn tất và ghi kết quả. Dữ liệu thử chỉ ở môi trường cục bộ; không sửa thông báo, bảng giá hoặc tài khoản thật.

Kiểm tra triển khai trên tên miền thật được thực hiện sau khi CI và bản Netlify preview thành công, rồi mới xác nhận hoàn tất cho người dùng.
