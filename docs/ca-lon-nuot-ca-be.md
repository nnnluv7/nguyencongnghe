# Cá lớn nuốt cá bé — biển thưa cá, 200 màn

Hành trình mở rộng từ 40 lên 200 màn. Giảm mật độ cá và tốc độ người chơi để biển có khoảng trống; độ khó tăng qua tốc độ cá, số mối nguy, tăng trưởng và thời gian bảo vệ. Điều khiển theo tay, giao diện Liquid Glass, tài khoản và bảng điểm NCN dùng lại hệ thống hiện hành.

## Cách chơi và cân bằng

- 200 màn, 5 nhân vật, 14 loài cá và 6 cảnh biển. Nhân vật mới mở ở màn 41, 81, 121 và 161. Mỗi màn có ba cỡ cá và hai mốc lớn lên. Màn 200 yêu cầu ăn vua cá mập thật để chiến thắng.
- Biển bắt đầu với mục tiêu 12 cá, tăng nhẹ đến 20 cá ở cuối hành trình, giới hạn cứng 22 kể cả cá đặc biệt. Chỉ có ba con mồi dẫn đường đầu màn. Cá bù và đàn nhỏ hai con bơi vào từ mép biển; không sinh quanh người chơi và không bù cả đàn tức thì.
- Tốc độ bơi cơ bản 310 đơn vị/giây. Click trái, Space hoặc Shift để lướt ngắn 0,2 giây, tốn 25 năng lượng và hồi chiêu 1,15 giây. Năng lượng hồi 15/giây khi nghỉ. Từ màn 9, giữ chuột phải, E hoặc nút Hút cá để hút con mồi ăn được, tiêu hao 26 năng lượng/giây. Không hút được cá lớn; phải thả ra sau khi cạn để dùng lại.
- Trên PC, cá bơi đến đúng con trỏ rồi dừng. WASD/phím mũi tên dùng cùng mô phỏng. Trên điện thoại, kéo trong biển điều khiển tương đối từ vị trí hiện tại; chạm ở nơi khác không làm cá nhảy tới tay. Joystick vẫn dùng được; cả hai đều dừng khi thả tay. Có thể vừa lái vừa lướt/hút bằng ngón thứ hai.
- Cá bơi theo luồng khi không đuổi. Đến gần phía trước cá lớn sẽ có dấu ! và một đợt đuổi 1,05–2 giây, rồi nghỉ, từ 6,5 giây ở màn đầu giảm còn 4,5 giây ở màn cuối. Bơi xa hơn phạm vi đuổi, đủ lớn để ăn được cá đó, có bảo vệ hoặc lá chắn sẽ ngắt đuổi. Màn đầu tối đa một con đuổi, từ màn 101 tối đa hai con; tốc độ đuổi chặn ở 225 đơn vị/giây, thấp hơn tốc độ bơi thường. Cá nguy hiểm thông thường giới hạn từ một con đầu hành trình lên năm con cuối hành trình. Tốc độ tăng tuyến tính từng màn; thời gian bảo vệ đầu màn giảm từ 6 xuống 2,5 giây. Khi bị cắn giữ nguyên tăng trưởng, dọn khoảng trống an toàn và bảo vệ 4 giây. Qua màn hồi một mạng.
- Hình vẽ nội suy giữa hai nhịp mô phỏng 60 Hz để cá, camera và hiệu ứng tiến đều trên màn hình 60–144 Hz. Giới hạn bù khung hình chậm ở 50 ms. Va chạm, điểm và điều khiển vẫn dùng trạng thái mô phỏng thật; thả tay dừng, không tạo quán tính. Khi mất mạng, sinh cá mới và tiếp tục sau tạm dừng, đồng bộ vị trí để không kéo vệt từ vị trí cũ.
- Không đếm ngược. Mô phỏng dừng khi qua màn và đợi bấm sang màn tiếp theo. Thua chơi lại màn hiện tại. Màn đã mở và kỷ lục được lưu sau khi qua màn.
- Combo tới ×5, cuồng ăn có thời hạn, cá vàng giúp tăng trưởng. Trên biển có tối đa hai vật phẩm cùng lúc; ngọc chỉ cho điểm. Đàn nhỏ đầu tiên sau 24 giây; đợt vật phẩm đầu sau 18 giây. Sứa từ màn 21, cá mập có báo trước từ màn 31. Trai đóng gây va chạm từ màn 81.
- Giảm đàn cá nền, bọt nước, vòng hướng dẫn và hiệu ứng ăn cá để khung hình thoáng hơn. Toàn màn hình vẫn có nút thoát trong biển và chế độ phóng đầy cửa sổ dự phòng; Escape/F/nút thoát trả lại trang và khả năng cuộn.

## Dữ liệu và phạm vi

Giữ khóa `ncn:fish:record:v1`, nâng schema lên 3 và giữ best/fish/wins/skin/sound/reduced. `unlocked` giới hạn 1–200. Người đã thắng hành trình 40 màn của schema 2 được tiếp tục ở màn 41; các tiến độ khác giữ nguyên. Đây là dữ liệu chơi cục bộ, không cấp danh tính hay quyền hạn.

Backend chỉ mở giới hạn màn của game `ocean` lên 200. Giữ mode `classic`, hồ sơ NCN chung, xác thực, quyền ADMIN/VIP, giới hạn của các game khác và bảo vệ điểm `score <= 1000 + 2500 × seconds`. Điểm cũ không bị thay bằng điểm thấp hơn.

Mô phỏng, hình cá, cảnh và âm thanh là mã/đồ họa NCN tự dựng. Không tải runtime ngoài. Các trò chơi khác, mẫu in và Liquid Glass chung giữ nguyên.

## Kiểm chứng

- Kiểm thử mô phỏng gồm điều khiển chính xác, ba cỡ cá, năng lượng, va chạm, tạm dừng, lưu/mở màn, chuyển dữ liệu cũ, đủ 200 màn và vua cá mập. Kiểm tra độ khó tăng đơn điệu, cá mới đi từ mép biển, giới hạn/đổi hướng/nghỉ đuổi, bảo vệ và đóng băng. Kiểm tra nhịp vẽ đều ở 60, 75, 90, 120, 144 Hz và góc quay qua ±π.
- Mô phỏng lái về con mồi gần nhất mỗi 300 ms, ba seed × 200 màn: 600 lượt, 549 qua màn, 51 thua và không có màn bị kẹt. Lượt hoàn thành dài 13,78–25,92 giây, tối đa 20 cá trong các mẫu này và 758 đợt đuổi. Đây là bot không chủ động né nguy hiểm, không phải đánh giá thời gian hay độ khó từ người chơi thật.
- Browser dùng HTTP fixture cục bộ, hồ sơ giả và chặn request ra ngoài. Kiểm tra 320–1440px, chuột, kéo tay, thả tay, joystick + lướt hai ngón, qua màn/tải lại, chuyển tiến độ cũ sang màn 41, mở màn 200, hút cá, nhịp vẽ 8 ms trên Canvas thật và dấu cá lớn đang đuổi, toàn màn hình, menu/tài khoản, cài đặt và cuộn trên Canvas.
- Theo dõi marker, vòng con mồi và sprite thực sự vẽ lên Canvas. Đồng hồ thử nghiệm dừng giữa các thao tác để tránh khung hình chạy ngầm. Cùng bộ browser chạy trên mã nguồn và bản dựng hash/SRI; NCN Arcade kiểm tra hồ sơ và lưu điểm qua backend giả. Không tạo hồ sơ hoặc điểm thử trên website công khai.

```sh
node --test tests/*.test.cjs tests/*.test.mjs
node tests/browser/ncn-fish.mjs
node scripts/build-public.mjs
node tests/ncn-performance-build.mjs
NCN_BUILT_TEST=1 node tests/browser/ncn-fish.mjs
node tests/browser/ncn-arcade.mjs
NCN_BUILT_TEST=1 node tests/browser/ncn-arcade.mjs
```
