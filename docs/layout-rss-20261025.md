# Giao diện, tải trang đồng bộ và RSS GenK

Ô Tìm công cụ có kích thước 280 × 46 px trên máy tính, bám mép phải của lưới; trên điện thoại chiếm một hàng riêng. Input và icon được căn giữa, không nhận chiều cao, margin hoặc font của biểu mẫu cũ. Tiêu đề Bài viết mới nhất dùng cùng cỡ và độ đậm với Bạn cần công cụ nào. Thẻ Thư viện và bài mới có chuyển động nâng nhẹ khi rê chuột, chuyển động đi và về cùng easing; người dùng bật giảm chuyển động sẽ không có hiệu ứng nâng/phóng ảnh.

## Nội dung ban đầu

114 trang HTML dùng cùng CSS đã cập nhật. Trang chủ và Thư viện dựng sẵn bài mới, mục nổi bật, bộ lọc, số lượng, phân trang và Story từ dữ liệu công khai hiện tại. Thông báo được đưa vào HTML cùng khoảng trống cho header ngay từ đầu. Các module dùng lại snapshot và renderer chung, tránh chèn các khối rỗng sau khi trang đã hiện. Module graph được preload trước các script cũ; website không đợi tải ảnh hay dùng màn che toàn trang.

72 trang công cụ, quản trị và tiện ích tĩnh được phục vụ qua `ncn-site-page`, với danh sách đường dẫn cố định trong `netlify/lib/ncn-shell/pages.json`. Các bài CMS và 40 bài gốc được quản lý vẫn dùng `ncn-library-page`; endpoint trang tĩnh không cho đọc tệp tuỳ ý hay vượt qua trạng thái bài đã gỡ/xoá. Không đưa thông tin đăng nhập hoặc quyền riêng tư vào HTML công khai. Những vùng phải kiểm tra phiên đăng nhập tiếp tục dùng trạng thái chờ xác thực của tài khoản chung.

Chạy `node scripts/prepare-public-shells.mjs` sau khi thêm hoặc xoá trang HTML để cập nhật URL, preload, fallback ban đầu và route allowlist. Script chạy lại không nhân bản thuộc tính hoặc nội dung. Tệp gốc và các quy tắc CSS của bản in được giữ nguyên.

## RSS GenK

Nguồn chính thức: https://genk.vn/rss/home.rss (danh mục: https://genk.vn/index.rss). `ncn-genk-sync` chạy mỗi 15 phút trên production, dùng ETag/Last-Modified và cập nhật snapshot có điều kiện trong kho `ncn-genk-feed-v1`. Lấy tối đa 40 tin mới nhất, loại trùng đường dẫn, giữ ngày đăng gốc, tiêu đề, ảnh RSS và mô tả tối đa 180 ký tự. Không lấy toàn bộ bài báo và không tạo bản sao bài đầy đủ trong CMS. Bấm thẻ mở GenK ở tab mới, có nhãn nguồn rõ ràng. Bộ lọc Nguồn cho chọn NCN, GenK hoặc cả hai; tìm kiếm và phân trang áp dụng cho cùng danh sách.

Tệp `netlify/lib/ncn-news/genk-seed.json` là bản khởi tạo từ RSS thật, dùng trước lần đồng bộ đầu tiên hoặc khi đọc cache gặp gián đoạn. Lỗi mạng/HTTP, RSS rỗng hoặc sai định dạng không ghi đè bản dữ liệu tốt trước đó. Chỉ tải URL cố định, không theo redirect; giới hạn kích thước, từ chối DTD/entity, giới hạn host bài và ảnh. RSS và dữ liệu CMS dùng kho riêng, nên lịch đồng bộ không ghi đè chỉnh sửa/xoá nội dung NCN.

## Kiểm chứng

`tests/ncn-public-render.test.mjs` kiểm tra feed, dữ liệu lỗi, cạnh tranh cập nhật, tìm kiếm ban đầu và cách ly route. `tests/browser/ncn-layout.mjs` trì hoãn module để đo bố cục trước/sau khởi tạo; kiểm tra desktop/mobile, cỡ chữ, căn ô tìm kiếm, nguồn GenK, phân trang, hover/reduced motion và cả 114 trang. Bộ kiểm tra chạy với kho/dữ liệu mô phỏng riêng, không tạo tài khoản hoặc đăng/xoá dữ liệu trên production.
