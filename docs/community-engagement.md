# Bình luận, cảm xúc và chia sẻ

Trang bài viết và khung xem Story dùng cùng giao diện Liquid Glass và tài khoản Netlify Identity hiện có. Thành viên đã xác nhận email có thể bình luận và chọn Thích, Không thích, Tim hoặc Giận. Mỗi tài khoản có một cảm xúc cho từng nội dung; chọn cảm xúc đang dùng sẽ bỏ chọn.

Khách chưa đăng nhập đọc được bình luận và số tương tác. Khi muốn gửi, website mở hộp đăng nhập chung. Tên hiển thị được công khai; email, mã tài khoản và khoá lưu trữ không được đưa vào phản hồi công khai. Bình luận là văn bản thuần, tối đa 1.000 ký tự. Thành viên xoá bình luận của mình; Admin xoá được mọi bình luận, qua bước xác nhận trong giao diện.

## Lưu trữ và quyền truy cập

- Hàm `ncn-engagement` lưu từng cuộc thảo luận trong store `ncn-community-engagement-v1`, đọc nhất quán mạnh và ghi có điều kiện theo ETag. Không lưu lượt tương tác trong localStorage.
- Server xác thực lại phiên Identity và trạng thái bài/Story. Bài ẩn, bản nháp, trang công cụ và Story đã xoá/hết hạn không nhận tương tác. Mọi POST kiểm tra Origin cùng website.
- Bình luận gửi lại với cùng requestId không tạo bản sao. Phân trang 20 bình luận, có nút xem thêm. Giới hạn 20 bình luận/tài khoản/giờ, 30 thao tác/phút để tránh gửi lặp và spam; mỗi cuộc thảo luận tối đa 500 bản ghi bình luận.
- Xoá bình luận loại bỏ tên, nội dung và khoá tác giả; chỉ giữ mã và thời điểm làm dấu chống gửi lại. Xoá Story đồng thời xoá cuộc thảo luận. Hàm dọn Story hiện có cũng dọn thảo luận hết hạn sau 24 giờ.
- Phản hồi riêng theo cookie dùng `private, no-store`; dữ liệu cá nhân không đi vào HTML/CDN cache. Bài viết tải phần thảo luận khi gần vùng nhìn thấy.

## Tin GenK

Theo lựa chọn của chủ website ngày 26/11/2026, chỉ dùng tóm tắt ngắn từ RSS chính thức, giữ ảnh đại diện và ghi nguồn GenK. Nút trên thẻ mở trang tóm tắt nội bộ `/tin-tuc-cong-nghe/?bai=rss-genk-…`, có bình luận, cảm xúc, nút đọc nguyên bài tại GenK và canonical riêng. Không thu thập hay đăng lại toàn văn.

Lịch đồng bộ RSS 15 phút hiện có giữ thêm metadata của từng tin đã đăng. Vì vậy liên kết chia sẻ và thảo luận vẫn dùng được khi tin rời danh sách 40 bài mới nhất. Không thêm lịch đồng bộ khác.

## Chia sẻ

- Facebook mở giao diện chia sẻ liên kết; Threads dùng web intent chính thức. Người dùng hoàn tất đăng trên nền tảng.
- TikTok và Instagram dùng Web Share khi trình duyệt hỗ trợ; người dùng chọn ứng dụng trong bảng chia sẻ. Website không thể ép hệ điều hành chọn một ứng dụng cụ thể.
- Khi không hỗ trợ Web Share, hiện liên kết có thể sao chép và nút mở TikTok/Instagram, kèm hướng dẫn. Không giả báo đã đăng. Không cài SDK theo dõi và không tự đăng lên tài khoản mạng xã hội.
- Story có liên kết `?story=story-…` mở đúng ảnh và thảo luận khi còn hạn. Sau 24 giờ, liên kết báo Story đã hết hạn; ảnh và bình luận không còn được phục vụ.

Tài liệu nền tảng: [Threads Web Intents](https://developers.facebook.com/documentation/threads/threads-web-intents), [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started/), [Instagram Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing). Đăng trực tiếp qua TikTok/Instagram là tích hợp khác, cần ứng dụng và quyền của từng tài khoản; hiện tại chỉ cung cấp luồng chia sẻ do người dùng chủ động hoàn tất.
