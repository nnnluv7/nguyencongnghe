# Đồng bộ màn hình chỉnh sửa và in — 24/10/2026

Ảnh mẫu của chủ website dùng vùng giấy lớn bên trái và phần In ngay/chỉnh sửa/hướng dẫn bên phải. Thay đổi này áp dụng cách bố trí đó bằng các điều khiển Liquid Glass dùng chung, giữ các mẫu giấy và dữ liệu hiện có.

## Phạm vi rà soát

- Kiểm kê toàn bộ 114 trang HTML ban đầu trong `public/`, cả bốn template Admin/VIP và ba catalogue mẫu.
- 102 mẫu, 112 bố cục: Sticker 25/35, Popup 33/33, biểu mẫu bán hàng và trang trí 44/44. Đối chiếu hash của toàn bộ 217 tệp hình/font trong catalogue.
- Cập nhật 25 đường dẫn công cụ: năm bộ chỉnh sửa chính, 16 trang in cũ, FIFO, kiểm quỹ và hai cổng Event/GVGS. Các trang thông tin, trò chơi, tư vấn và đăng nhập giữ bố cục hiện có.
- Hai URL trùng `/p/ban-hang.html` và `/p/trang-tri.html` chuyển 301 về bộ chỉnh sửa hiện hành; còn 112 trang HTML nguồn, các bookmark cũ vẫn có đường chuyển tiếp.

## Giao diện và thao tác

- Nút In ngay, tải HTML, số tờ, phóng to/vừa trang, khổ giấy và chỉnh nội dung nằm trong thanh bên. Tái sử dụng chính các nút/ô nhập cũ để giữ các xử lý kiểm tra dữ liệu và xuất bản in.
- Màn hình nhỏ chuyển thành một cột, thu gọn các nhóm tùy chọn. Giấy vẫn trắng trong cả chế độ sáng/tối; các điều khiển bên ngoài dùng Liquid Glass.
- Sửa trực tiếp từng bản trên giấy, áp dụng cả nhóm, cỡ chữ, nhập Excel/CSV, nhân đôi/xóa nội dung và chuyển tờ vẫn dùng bộ xử lý hiện có.
- Xem trước một trang không còn thanh cuộn bên trong che mất mép giấy. Phần phóng to vẫn cuộn/pan trong khung, không làm tràn toàn trang.
- Mẫu cũ giữ nguyên toàn bộ HTML của vùng in. Các hình nền của mẫu được giữ, không thay bằng nền của giao diện. FIFO giữ 48 ô nhãn và bảng nhập bảy nhóm.
- Kiểm quỹ giữ form đơn giản đã duyệt, chín mệnh giá và dấu phẩy ERP; nút In phiếu mở cùng kiểu cửa sổ giấy/điều khiển. Đóng cửa sổ trả focus về nút in.
- Admin và VIP của Event/GVGS dùng cùng cửa sổ xem trước, vẫn tải mẫu và giá qua API có phân quyền. Không đưa các template hay dữ liệu giá vào tài nguyên công khai mới.

## Kiểm chứng

- 67/67 kiểm thử Node đạt; kiểm tra cú pháp các module và `git diff --check` đạt.
- Browser gallery kiểm tra đủ 112 bố cục ở A4, A5 và A5 ngang: không có ô nhập nằm ngoài tờ giấy. Các cỡ giấy ghi nhận 794×1123, 559×794, 794×559 px ở 96dpi.
- Mở đủ 16 trang in cũ: không trang xem trước trống, không tràn ngang toàn tài liệu, hình nền giữ nguyên. Hash 17 vùng in (gồm FIFO) và bảy module dựng bản in được đối chiếu trong `print-workspace-baseline.json`.
- Chín nhóm màn hình được kiểm tra ở iframe điện thoại 390px: Sticker, Popup, biểu mẫu bán hàng, Trang trí, FIFO, mẫu cũ, kiểm quỹ, Event, GVGS.
- Sửa riêng hai sticker giữ các bản khác nguyên vẹn. Đổi từ sáu nhãn/tờ sang hai nhãn/tờ, chuyển tờ 2/3, và nhập chữ trang trí NCN đều cập nhật đúng. FIFO thử phiên bản QA128/màu Bạc/số lượng 2 vẫn sinh đúng nội dung và giữ 48 ô.
- Nội dung Blob do đúng nút Tải bản in của Sticker, Popup và biểu mẫu bán hàng tạo ra chứa đúng dữ liệu vừa sửa, ảnh/font nhúng và không có script/điều khiển xem trước. Sự kiện download của công cụ trình duyệt hết thời gian, nên không xác nhận đường dẫn tệp đã lưu trong Downloads; kiểm tra nội dung xuất được thực hiện bằng bộ bắt Blob chỉ có trong fixture QA.
- Bốn template riêng được kiểm tra bằng dữ liệu giả tại preview nội bộ, không thao tác với bảng giá/tài khoản thật. Quyền API và tài nguyên dựng bản in được giữ nguyên và có kiểm thử hồi quy.

Fixture QA và dữ liệu giả chỉ có ở bản preview nội bộ, không thuộc nội dung commit. Sau khi GitHub CI và Netlify preview đạt sẽ triển khai và kiểm tra lại các URL thật.
