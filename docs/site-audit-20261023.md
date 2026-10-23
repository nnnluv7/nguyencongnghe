# Kiểm tra website NCN ngày 23/10/2026

Bản kiểm tra dựa trên commit `6cb46f775816fb8bbbbf2027b985707b442d99da` của nhánh main. Giữ bố cục và giao diện Liquid Glass đã được chủ website chốt.

## Phạm vi và kết quả

- Đã kiểm tra cấu trúc của toàn bộ 116 trang HTML trong public: 115 trang dùng một bộ menu/header/footer chung; game có menu chuyên biệt để không ảnh hưởng thao tác chơi.
- Không phát hiện ID trùng trong DOM tĩnh hoặc đường dẫn JavaScript, CSS, ảnh nội bộ bị thiếu.
- Có ba bản sao công cụ in tại /p/sticker.html, /p/popup-a7.html và /p/popup-a4-a5-a6.html. Nội dung ứng dụng của mỗi bản sao giống hệt trang chính. Đã bỏ ba bản sao và thêm chuyển hướng 301 về /sticker/, /popup-a7/ và /popup-a4-a5-a6/. Không xóa mẫu in hoặc nội dung công cụ.
- Đã bỏ 112 khối CSS nền cũ được nhúng lặp trong các trang còn lại. Quy tắc sáng/tối và bản in cần thiết được chuyển vào site.css; bộ điều khiển chọn giao diện được giữ nguyên.
- Đã bỏ 31 workflow cài đặt một lần của các phiên bản trước. Chúng chứa mã ghi lại giao diện/công cụ cũ và có thể làm mất các sửa đổi mới nếu chạy lại. Thay bằng NCN checks chỉ đọc mã và chạy kiểm tra, không tự ghi lại giao diện.
- Alias JavaScript easy-ui.js được chuyển tới tool-ui.js bằng rewrite để các tab/đường dẫn đã lưu vẫn hoạt động; chỉ còn một triển khai helper.
- Thẻ, tab tìm kiếm và nút chọn cỡ ở Sticker/Popup/công cụ cửa hàng dùng viền, bo góc và ánh kính chung. Giữ màu phân biệt cỡ in, số cột, dữ liệu, kích thước bản in và logic thao tác.

Sau khi bỏ ba bản sao, còn 113 trang HTML công khai. Các bản sao lưu ngoài public vẫn được giữ để tham chiếu; chúng không được xuất bản thành giao diện.

## File Admin trong Event VIP và GVGS

Hai công cụ có hai thao tác riêng:

1. **Xóa bảng giá đã lưu**: chọn bảng giá đã được tải, bấm nút rồi xác nhận tên/mã chương trình. Dữ liệu sản phẩm của đúng bảng giá đó được xóa khỏi kho dùng chung. Bảng giá không còn xuất hiện trong lựa chọn, không thể in lại từ lịch sử đã cũ và không chiếm một trong 20 chương trình đang hoạt động.
2. **Bỏ file đang nhập**: bỏ dữ liệu nguồn và danh sách đang mở trên thiết bị, không xóa bảng giá đã lưu trên web. Sau đó có thể chọn file mới.

Máy chủ kiểm tra lại quyền ADMIN, origin, mã chương trình và phiên bản. Yêu cầu từ VIP/khách hoặc phiên bản cũ bị từ chối. Xóa dùng ghi có điều kiện theo ETag; bản ghi còn lại chỉ là dấu xóa tối thiểu, không giữ tên hay danh sách sản phẩm. Cách này tránh xóa nhầm bản mới vừa được Admin khác lưu vì SDK Blobs không hỗ trợ ETag có điều kiện ở delete(). Có thể tạo mới lại cùng mã bằng thao tác lưu mới.

Event và GVGS vẫn dùng hai kho dữ liệu riêng. Không xóa bất kỳ bảng giá thật nào trong quá trình kiểm tra.

## Kiểm chứng và giới hạn

- Bộ kiểm tra bổ sung bao phủ tạo/xóa/tạo lại, quyền truy cập, origin, phiên bản cũ, ghi đồng thời, giới hạn 20 chương trình, in từ lịch sử đã xóa và cách ly hai kho.
- Kiểm tra cấu trúc trang bao phủ menu, ID, tài nguyên nội bộ, chuyển hướng trang cũ và việc chỉ Admin có nút xóa.
- Trước khi môi trường bị ngắt, đã quan sát trang chủ thật và bản xem thử trên khung điện thoại của Trang chủ, Kiểm quỹ, Vòng quay, Trang trí, Sticker và Popup A7; sáu trang không tràn ngang ở khung 390 px. Đã thử hủy/xác nhận xóa bảng giá Event, xóa bảng cuối và bỏ file GVGS bằng dữ liệu giả lập.
- Môi trường trình duyệt bị ngắt trước khi hoàn tất các nhóm trang còn lại và trước khi xem lại các chỉnh sửa nhỏ cuối cùng ở nút/tab Sticker/Popup. Không coi đây là kiểm chứng trực quan cho mọi trang.
- Chưa thử xóa bằng tài khoản Admin thật trên website production. Các thao tác dữ liệu được kiểm tra bằng kho giả lập; chức năng Netlify production vẫn bắt buộc phiên đăng nhập và quyền thật.

## Bảo trì

Chỉnh trực tiếp mã nguồn rồi chạy NCN checks. Không chạy lại các installer của phiên bản trước từ lịch sử Git. Nếu cần khôi phục bản sửa này, dùng Revert của commit/PR tương ứng; các file sao lưu cũ vẫn được giữ trong kho.
