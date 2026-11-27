# NCN Android

Ứng dụng Android dùng website `https://nguyencongnghe.com`, tài khoản Netlify Identity và giao diện Liquid Glass hiện có. Firebase chỉ phục vụ Cloud Messaging; không thêm hệ thống tài khoản hay sao chép dữ liệu khách hàng sang Firebase.

- Application ID: `com.nguyencongnghe.app`; Firebase project: `nguyencongnghe-92793`.
- Android 7.0 trở lên, Android System WebView được cập nhật; nhận FCM cần Google Play services. Android 13+ cần người dùng cấp quyền thông báo.
- Mỗi lần đăng nhập/mở lại app, server kiểm tra quyền Admin trước khi đăng ký thiết bị. Tài khoản Audio vẫn xử lý đơn như trên website nhưng không tự được đăng ký nhận thông báo Admin.
- Mã thiết bị, FCM token và mã thu hồi chỉ phục vụ đăng ký/đổi token/thu hồi thiết bị. Không đưa JWT, mật khẩu hoặc khóa máy chủ vào APK.
- Khi đăng xuất, app tắt nhận, xoá token FCM và thu hồi đăng ký. Việc thu hồi riêng thiết bị dùng một mã ngẫu nhiên để vẫn thực hiện được sau khi cookie bị xoá.
- Đăng ký được kiểm tra lại khi app hoạt động và hết hạn sau 30 ngày. Thông báo chỉ chứa mã đơn và loại sự kiện, không chứa tên, số điện thoại hoặc kịch bản; mở đơn phải qua kiểm tra quyền trên server.
- Có thông báo khi tạo đơn và khi SePay xác nhận đúng số tiền. Chạm thông báo mở `/thu-audio/?don=NCNAUD…#audio-history`, bao gồm cả đơn đã rời trang lịch sử đầu tiên.
- Outbox idempotent nằm trong kho Audio hiện có. Worker Netlify chạy mỗi phút khi đã cấu hình khóa, dùng lease và retry; app loại thông báo lặp theo mã sự kiện. Lỗi thông báo không làm thất bại việc tạo đơn hoặc ghi nhận chuyển khoản.
- Website trên trình duyệt thông thường không khởi động cầu nối Android, không gọi thêm API thông báo. Các quyền và trạng thái thanh toán hiện có được giữ nguyên.

## Cấu hình máy chủ

Biến môi trường Netlify cho production, scope Functions: `NCN_FIREBASE_SERVICE_ACCOUNT`. Giá trị là JSON service account của đúng project Firebase. Chỉ cấp vai trò gửi FCM (`roles/firebasecloudmessaging.admin`) cho tài khoản dịch vụ chuyên dụng. Không dùng khóa này trong APK, Git hoặc cấu hình client.

`GET /.netlify/functions/ncn-push?route=status` trả `ready:false` khi chưa cấu hình. App vẫn mở website và xử lý đơn; việc gửi thông báo chỉ được bật sau khi thêm khóa hợp lệ và triển khai lại. Dùng điện thoại thật đã đăng nhập Admin để kiểm tra nhận thông báo khi app chạy nền. Không tạo đơn hoặc chuyển khoản giả trên production để kiểm thử tự động.

Người dùng cần mở app sau khi cài đặt, cho phép thông báo và đăng nhập Admin. Android có thể trì hoãn thông báo khi mất mạng hoặc bị hệ điều hành hạn chế; thao tác buộc dừng app cần mở lại app. Không chạy dịch vụ kiểm tra đơn liên tục trên điện thoại.

## Biên dịch

Từ thư mục `apps/android`, dùng JDK 17+, Android SDK 35, Gradle 8.11.1:

```sh
gradle --no-daemon :app:assembleRelease :app:testReleaseUnitTest
```

Thiết lập `NCN_ANDROID_KEYSTORE`, `NCN_ANDROID_STORE_PASSWORD`, `NCN_ANDROID_KEY_PASSWORD`; alias `ncn`. Giữ bản sao khóa ký riêng để các bản APK tiếp theo cập nhật được ứng dụng đã cài. Tải `google-services.json` từ Firebase Console → Project settings → Your apps → NCN rồi đặt vào `apps/android/app/`. Tệp này được bỏ qua bởi Git, vì mã client công khai bị bộ quét của dịch vụ triển khai web nhận nhầm là khóa bí mật. `google-services.example.json` là bản mẫu chỉ chứa định danh và chỗ điền API key Android. Các khóa máy chủ vẫn luôn ở biến môi trường riêng.

App dùng WebView chỉ cho tên miền chính thức; liên kết ngoài mở ứng dụng/trình duyệt tương ứng. Không cho truy cập file, mixed content, bỏ qua lỗi chứng chỉ hoặc cầu nối từ iframe. File upload đi qua trình chọn tệp Android. Với tải tệp blob và một số thao tác in, mở website bằng trình duyệt Android.

Tham khảo: [FCM Android](https://firebase.google.com/docs/cloud-messaging/android/get-started), [FCM server](https://firebase.google.com/docs/cloud-messaging/server-environment), [WebMessageListener](https://developer.android.com/reference/androidx/webkit/WebViewCompat).
