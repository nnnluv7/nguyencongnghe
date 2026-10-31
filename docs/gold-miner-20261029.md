# Đào vàng PC cổ điển — bản 200 màn

Trang `/dao-vang/` dùng tranh Canvas/SVG tự vẽ theo những nét nhận diện của bản PC: bảng tiền vàng, bác thợ mỏ tóc bạc ngồi quay máy trong vòm xanh, nền đất uốn lớp, vàng vàng tươi có khối, đá xám, túi dấu hỏi đỏ, kim cương và chuột chũi. Mọi hình đều vẽ theo độ phân giải màn hình, không phóng lớn ảnh Flash. Ảnh bìa và linh vật mới thống nhất với game. Khung ngoài, cửa hàng, hộp thoại và tài khoản dùng Liquid Glass của NCN.

## Hành trình và độ khó

- 200 màn, 20 chặng và 10 vùng mỏ. Hôm nay vẫn là 5 màn chung seed theo ngày Việt Nam.
- Giữ bốn mốc tiền đầu quen thuộc khi vừa đạt mục tiêu: 650 → 1195 → 2010 → 3095. Mỗi màn mới cần đào thêm một chỉ tiêu; tiền dư không tự mở màn sau. Mua đồ dùng tiền có, điểm xếp hạng là tổng tiền đào và không giảm theo chi tiêu.
- Từ màn 5, chỉ tiêu đào mới tăng liên tục. Màn 200 cần đào thêm $9.289. Thời gian giảm từ 60 xuống 45 giây, nhịp lắc tăng từ 0,7 lên 1,2 rad/giây và sức nặng khi kéo tăng 45%.
- Đá tăng từ 3 đến 10; TNT từ màn 3, tăng đến 4 thùng; chuột chũi từ màn 4, tăng đến 5 con và chạy nhanh, xa hơn. Giá khoáng vật tăng theo độ sâu. Vàng khối lớn từ màn 51 rất nặng. Kim cương ở sâu và nhỏ, cần canh chính xác.
- Bộ sinh mỏ giữ một số đường móc có giá trị không bị vật khác chặn ngay từ đầu. Độ khó nằm ở canh thời điểm, chọn vật có lợi và tránh TNT, không phải một bản đồ ngẫu nhiên hết đường đào.
- Đủ chỉ tiêu có thể bấm Qua màn hoặc đào thêm. Vật chưa kéo lên không được tính tiền. Thuốc nổ phá vật đang kéo; TNT nổ lan và phá cả vàng gần đó.
- Cửa hàng vẫn có thuốc nổ, nước tăng lực, cỏ may mắn, sách đá và đánh bóng kim cương. Nâng cấp dùng cho màn kế tiếp, thuốc nổ mang theo. Các vật phẩm có tác dụng thật trong mô phỏng.

Space / ↓ / click chuột / chạm mỏ / nút Thả móc để thả. ↑ / D / Thuốc nổ để phá vật đang kéo. P tạm dừng; F toàn màn hình. Vuốt dọc trên mỏ vẫn cuộn trang, không thả móc nhầm. Menu, hộp thoại, đổi tab và mất focus đều tạm dừng.

## Tiến độ, điểm và tương thích

Giữ các khóa lưu hiện có và kỷ lục. Save schema 1 vẫn khôi phục đúng màn, móc, vật đang kéo, cửa hàng và đồng hồ 60 giây; sang màn tiếp chuyển sang schema 2. Schema 2 lưu tiền/điểm ở đầu màn để kiểm tra mục tiêu và kinh tế, đồng hồ theo độ khó, hình học và payload. Khôi phục luôn bắt đầu ở trạng thái nghỉ. Tiến độ cục bộ không cấp vai trò tài khoản.

Gold classic được máy chủ nhận đến màn 200, daily giới hạn 5. Giữ nguyên hồ sơ chung 8 game, phân bảng theo mode/ngày, quyền sở hữu lượt chơi và giới hạn `score <= 1000 + 2500 × seconds`. Không giảm điểm cũ bằng kết quả thấp hơn. Chơi nhanh không tạo hồ sơ hay điểm công khai. Các mẫu in và game khác giữ hành vi hiện có; chỉ mô tả danh mục Đào vàng được cập nhật từ 100 sang 200 màn trên toàn site.

## Kiểm chứng

- Mô phỏng: đủ 200 mỏ trên ba seed, vị trí không chồng nhau, ray móc có đủ giá trị, va chạm theo đoạn quét, cân nặng, vật phẩm, kinh tế, deadline, mốc kết thúc 200/5, lưu cũ/mới và giới hạn mole.
- Bot canh móc chính xác trên ba seed × 200 màn, không/có nước tăng lực: 1.200 lượt đều đạt chỉ tiêu. Bot dùng thời gian lắc thật và thao tác thả/phá, không dịch chuyển móc đến vật. Đây là kiểm tra khả năng hoàn thành, không phải đánh giá độ khó từ người chơi thật.
- Browser trên mã nguồn và bản dựng: 320px đến desktop; toàn màn hình native/dự phòng, ngang/dọc; kéo vàng và gửi điểm thật qua backend giả; lưu khi đang kéo; mua đồ qua reload; daily; màn 200 và win; chuyển save cũ 100 → 101; tiền dư; tap/vuốt điện thoại; chặn storage; theme tối; menu và cuộn trang.
- Tất cả API thử nghiệm ở fixture cô lập. Không tạo hồ sơ/điểm thử trên website công khai. Giữ kiểm tra build hash/SRI, gói Netlify, tài khoản dùng chung, bố cục, bản in và hiệu năng.

Tham khảo hình và thao tác cổ điển: [Gold Miner tại nhà phân phối GameFools](https://www.gamefools.com/onlinegames/play/goldminer.html). Không đóng gói tài nguyên của game gốc hoặc runtime bên ngoài.
