# Đưa nguyencongnghe.com lên GitHub + Netlify

Kho mã: https://github.com/nnnluv7/nguyencongnghe
Tên miền: nguyencongnghe.com

## 1. Tải lên GitHub

Sau khi giải nén gói ngoài nguyencongnghe-github-netlify.zip, có đúng ba tệp:
- website.zip: toàn bộ website đã dựng, gồm trang chủ, các bài viết, công cụ và tài nguyên.
- netlify.toml: cấu hình để Netlify tự giải nén và xuất bản website.
- HUONG-DAN.md: hướng dẫn này.

Trên Mac, nhấp đúp gói ngoài để mở. Giữ website.zip nguyên dạng ZIP để tải lên GitHub.

Mở kho https://github.com/nnnluv7/nguyencongnghe, chọn Add file → Upload files. Kéo cả ba tệp vào, đợi tải xong, chọn Commit directly to the main branch nếu có rồi bấm Commit changes.

Các tệp phải nằm trực tiếp ở cấp đầu của kho, cùng cấp với README.md nếu kho đã có README. Gói này không thay README hiện tại.

Kho GitHub lúc này chứa code; bước tiếp theo là liên kết với Netlify để website chạy.

## 2. Kết nối với Netlify

1. Vào https://app.netlify.com/signup và đăng ký hoặc đăng nhập. Có thể chọn GitHub.
2. Chọn gói Free.
3. Trong danh sách project, chọn Add new project → Import an existing project. Tên nút có thể là Add new site.
4. Chọn GitHub. Khi được hỏi, cho Netlify quyền đọc kho nnnluv7/nguyencongnghe.
5. Chọn đúng kho nguyencongnghe và nhánh main.
6. Netlify đọc netlify.toml đã tải lên. Nếu giao diện yêu cầu nhập:
   - Base directory: để trống.
   - Build command: python3 -m zipfile -e website.zip public
   - Publish directory: public
   - Environment variables: không cần thêm cho bản này.
7. Bấm Deploy / Deploy project, đợi build hoàn thành. Nếu bản mới yêu cầu Publish để mở công khai, bấm Publish sau khi build thành công.
8. Mở địa chỉ thật Netlify cấp có đuôi .netlify.app để kiểm tra trang chủ, các công cụ, menu và mẫu in.

Tệp netlify.toml chỉ xuất bản nội dung website trong public. website.zip và các tệp hướng dẫn ở cấp đầu của kho không được đưa lên làm trang web.

Nếu build báo không tìm thấy website.zip, kiểm tra ba tệp ở cấp đầu của kho và Base directory để trống.

## 3. Kết nối nguyencongnghe.com

Thực hiện khi website đã chạy ở địa chỉ .netlify.app.

1. Trong project Netlify, mở Domain management → Production domains → Add a domain / Add a custom domain.
2. Thêm nguyencongnghe.com. Netlify thường thêm cả www.nguyencongnghe.com.
3. Bấm Pending DNS verification để xem cấu hình DNS chính xác của project.
4. Nếu DNS đang do GoDaddy quản lý, mở GoDaddy → Miền → nguyencongnghe.com → DNS → Quản lý bản ghi.
5. Với hạ tầng Netlify tiêu chuẩn, cấu hình như sau:

| Loại | Tên / Host | Giá trị |
| --- | --- | --- |
| A | @ | 75.2.60.5 |
| CNAME | www | ten-site-thuc-te.netlify.app |

Thay ten-site-thuc-te.netlify.app bằng đúng tên miền Netlify hiển thị ở project của anh; không dùng địa chỉ ví dụ. Chỉ thay các bản ghi A/AAAA của @ hoặc CNAME của www đang trỏ web sang nơi cũ và gây xung đột. Giữ các bản ghi MX, TXT và bản ghi khác phục vụ email/xác minh. Nếu Netlify hiển thị giá trị khác trong Pending DNS verification, dùng giá trị dành riêng cho project đó.

Giữ DNS ở GoDaddy khi dùng cách này. Sau khi DNS đồng bộ và Netlify cấp HTTPS, mở https://nguyencongnghe.com. Việc đồng bộ có thể mất tới một ngày.

Gói Netlify Free có hạn mức sử dụng hằng tháng. Xem số liệu ở Usage & billing khi website bắt đầu có người dùng.

## 4. Nội dung đã chuẩn bị

- Giữ nguyên nội dung, giao diện, công cụ của bản dựng Chuyengia.vip đã làm.
- Chỉnh canonical và địa chỉ chia sẻ thành https://nguyencongnghe.com.
- Có sitemap.xml và robots.txt cho phép công cụ tìm kiếm đọc bản website mới.
- Các thư viện, ảnh và phông chữ được đóng kèm.
- Thư mục tài nguyên giữ nguyên; script công cụ không bị sửa trong lần đóng gói này.

## 5. Phần vẫn dùng dịch vụ gốc

Đăng nhập, đăng ký và lịch sử bài thi vẫn gọi Google Apps Script của website gốc. Bản dựng không chứa tài khoản, mật khẩu, dữ liệu riêng hoặc mã máy chủ của anh. Việc triển khai frontend không tự tạo thêm máy chủ tài khoản.

Nguồn câu hỏi Google Sheets và các tệp tải/video bên ngoài vẫn cần liên kết gốc hoạt động. Liên hệ mở trang liên hệ gốc. Bình luận lưu tại thiết bị, không đồng bộ Blogger.

Các kiểm tra DOM và đường dẫn của bản gốc đã đạt; lần đóng gói này kiểm tra lại cấu trúc, tài nguyên, các URL tên miền và chạy đúng lệnh build ghi trong netlify.toml. Chưa kiểm tra giao diện bằng trình duyệt thực hoặc đăng nhập thật với API gốc.

## Tài liệu chính thức

- Tải tệp GitHub: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Kết nối GitHub và build Netlify: https://docs.netlify.com/build/configure-builds/overview/
- Cấu hình netlify.toml: https://docs.netlify.com/build/configure-builds/file-based-configuration/
- DNS ngoài Netlify: https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/
- Gói Netlify: https://www.netlify.com/pricing/
