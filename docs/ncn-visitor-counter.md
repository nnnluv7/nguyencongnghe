# NCN - Bộ đếm lượt truy cập Netlify (bản cho repo nnnluv7/nguyencongnghe)

Đã chuẩn bị các file theo đúng kiến trúc `public/` + `netlify/functions/` của website. KHÔNG dùng bản PHP cũ: Netlify không thực thi PHP theo kiểu hosting truyền thống.

## Ba chỉ số

- **Đang online**: số phiên trình duyệt có tín hiệu hoạt động trong khoảng 2 phút gần nhất, tự làm mới 30 giây/lần; là số gần đúng.
- **Hôm nay**: số phiên có truy cập trong ngày, tính theo múi giờ Việt Nam UTC+7.
- **Tổng truy cập**: tổng số phiên truy cập kể từ khi bộ đếm được kích hoạt. Mỗi tab dùng `sessionStorage` và chỉ tính một lần cho một phiên, không phải tổng lượt tải trang hay số người dùng duy nhất.

## Triển khai

Các file trong ZIP là **bản vá (patch)**, không phải toàn bộ mã nguồn. Giữ nguyên cấu trúc đường dẫn như trong gói, chép/ghi đè vào thư mục gốc repo. Nếu chỉ tải ZIP mà không dùng PR, cần thêm dòng `import './visitor-counter.js';` vào đầu file `public/assets/ncn-theme/theme.js` (đã được thực hiện trên nhánh PR). Push/merge lên nhánh `main`, chờ Netlify deploy và tải mới website. GitHub Actions trong `.github/workflows/kiem-tra-bo-dem-ncn.yml` kiểm tra cú pháp và unit test.

Endpoint: `/.netlify/functions/ncn-visitors`. Bộ đếm hiển thị ở chân trang `#ncn-footer` trên các trang tải theme.js. Netlify Function dùng `@netlify/blobs` có sẵn trong package.json. Scheduled Function `ncn-visitors-cleanup.mjs` dọn bản ghi online cũ mỗi giờ.

## Lưu ý và giới hạn

Không thu thập IP hay đặt cookie; session ID ngẫu nhiên ở sessionStorage. Dữ liệu nằm trong Netlify Blobs, không nằm trong YAML/GitHub. Nhánh deploy preview sử dụng blob theo từng deploy để tránh tăng lượt của website thật. Lượt truy cập không thể được hồi tố trước lúc cài. Việc ghi marker phiên và tăng số đếm gồm hai thao tác (không phải giao dịch nhiều key); nếu một Function bị ngắt giữa chừng thì có thể bỏ sót số đếm. Đây là số liệu tham khảo, không thay thế nền tảng phân tích chuyên dụng cho website nhiều lưu lượng hoặc mục đích kiểm toán.
