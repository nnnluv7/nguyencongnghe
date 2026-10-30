# Cá lớn nuốt cá bé — hành trình PC cổ điển

Bản trước dùng một lượt chơi dài qua sáu vùng biển và trên điện thoại cá tiếp tục bơi khi thả tay. Bản này chuyển sang từng màn ngắn, cá dừng theo tay người chơi và có thực đơn chỉ rõ loài ăn được. Giao diện, tài khoản và bảng điểm NCN dùng lại hệ thống hiện hành.

## Cách chơi

- 40 màn, 5 nhân vật, 14 loài cá và 6 cảnh biển. Mỗi màn có ba cỡ cá, hai mốc lớn lên trên thanh tăng trưởng và màn qua rõ ràng. Màn 40 yêu cầu ăn vua cá mập thật để chiến thắng.
- Trên PC, cá bơi đến đúng con trỏ và dừng, không vượt qua mục tiêu. WASD/phím mũi tên dùng cùng mô phỏng. Click trái, Space hoặc Shift để lướt ngắn.
- Trên điện thoại, chạm kéo trong biển điều khiển tương đối từ vị trí hiện tại, không kéo cá nhảy tới ngón tay. Joystick cố định vẫn dùng được; cả hai đều dừng khi thả tay. Có thể vừa lái vừa lướt/hút bằng ngón thứ hai.
- Từ màn 9, giữ chuột phải, phím E hoặc nút Hút cá để kéo con mồi ăn được phía trước. Năng lượng có giới hạn và phải thả ra sau khi cạn để dùng lại. Giữ E vẫn điều khiển chuột được.
- Cá bơi theo luồng dễ đoán, không liên tục đuổi người chơi. Màn đầu có tối đa hai cá nguy hiểm ở xa, ít nhất bảy con mồi ở gần và khoảng biển dễ đọc hơn. Có tám giây bảo vệ đầu màn; bị cắn giữ nguyên tăng trưởng, được bảo vệ năm giây và dọn khoảng trống an toàn.
- Không có thời gian đếm ngược. Qua màn hồi một mạng, dừng mô phỏng và đợi người chơi bấm sang màn kế tiếp. Thua chơi lại màn hiện tại; màn đã mở và kỷ lục được lưu sau khi qua màn.
- Combo tới ×5, cuồng ăn có thời hạn, cá vàng giúp tăng trưởng, trai mở có ngọc, lá chắn, trái tim, tăng tốc và đóng băng. Ngọc chỉ cho điểm, không làm cá lớn lên. Sứa và cá mập báo trước chỉ xuất hiện từ màn 9.
- Toàn màn hình có nút thoát trong biển. Nếu API toàn màn hình không có hoặc bị trình duyệt từ chối, dùng chế độ phóng đầy cửa sổ; Escape/F/nút thoát trả lại trang và khả năng cuộn.

## Dữ liệu và phạm vi

Mô phỏng, hình cá, cảnh và âm thanh là mã/đồ họa NCN tự dựng. Không đóng gói tài nguyên của Feeding Frenzy hoặc tải runtime từ dịch vụ bên ngoài.

Giữ `ncn:fish:record:v1` và di chuyển dữ liệu sang schema 2: giữ nguyên best/fish/wins/skin/sound/reduced, thêm `unlocked` từ 1 đến 40. Đây là dữ liệu chơi cục bộ, không phải danh tính hoặc quyền hạn. Không đổi xác thực, quyền ADMIN/VIP, backend bảng điểm hay bài viết. Vẫn gửi kết quả qua game `ocean`, mode `classic` bằng hồ sơ NCN chung; điểm các thành viên đã có không bị ghi đè bằng điểm thấp hơn.

Điểm thưởng được cân theo giới hạn hợp lệ hiện tại của máy chủ. Kiểm thử các lượt chơi nhanh và chơi lại màn cao xác nhận `score <= 1000 + 2500 × seconds`, giữ nguyên bảo vệ phía máy chủ.

Mã thay đổi chỉ nằm trong trang game, kiểm thử, workflow game và tài liệu này. Các trò chơi khác, mẫu in và giao diện Liquid Glass chung giữ nguyên.

## Kiểm chứng

- Kiểm thử mô phỏng bao gồm dừng đúng mục tiêu, thả tay không trôi, ba cỡ cá, mốc mở kỹ năng, giới hạn năng lượng, bất tử có hạn, dừng/tiếp tục, lưu dữ liệu cũ, đủ 40 màn và vua cá mập.
- Mô phỏng điều khiển theo mục tiêu cách nhau 400 ms trên năm seed × 40 màn: 200 lượt đều hoàn thành. Đây là kiểm tra mô phỏng, không phải đánh giá từ người chơi thật.
- Browser dùng HTTP fixture cục bộ và hồ sơ giả, chặn mọi request ra ngoài. Kiểm tra bảy cỡ màn 320–1440px, chuột, kéo tay không nhảy vị trí, thả tay dừng, joystick + lướt hai ngón, qua màn rồi tải lại, kỹ năng màn 9, toàn màn hình dự phòng, menu/tài khoản, âm thanh, giảm chuyển động và cuộn trên Canvas.
- Theo dõi vị trí hiển thị bằng marker/vòng con mồi thực sự vẽ lên Canvas. Đồng hồ thử nghiệm dừng giữa các thao tác và chỉ chạy khi có tick, tránh so sánh vị trí qua những khung hình vô tình chạy thêm.
- Chạy cùng bộ browser trên mã nguồn và bản dựng có hash/SRI; bộ NCN Arcade kiểm tra lưu điểm và hồ sơ thật bằng backend giả. Không tạo hồ sơ hoặc điểm thử trên website công khai.

```sh
node --test tests/*.test.cjs tests/*.test.mjs
node tests/browser/ncn-fish.mjs
node scripts/build-public.mjs
node tests/ncn-performance-build.mjs
NCN_BUILT_TEST=1 node tests/browser/ncn-fish.mjs
node tests/browser/ncn-arcade.mjs
```

Tham khảo cách chơi: [bản PC do Shockwave phân phối](https://www.shockwave.com/gamelanding/feedingfrenzy), [giới thiệu chính thức Xbox](https://news.xbox.com/en-us/2006/03/16/feeding-frenzy/amp/), [hướng dẫn PopCap](https://static-www.ec.popcap.com/support.popcap.com/sites/support.popcap.com/files/XBox_Vol1_manual.pdf).
