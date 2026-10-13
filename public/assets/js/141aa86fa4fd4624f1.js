
var qrcode = new QRCode(document.getElementById("qrcode"), {
    text: "",
    width: 128,
    height: 128,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
});

function makeCode1() {
    var textCode = document.getElementById('textCode').value;
    qrcode.clear();
    qrcode.makeCode(textCode);
}

// Thêm sự kiện "keyup" vào phần tử #textCode
$("#textCode").on("keyup", function (e) {
    if (e.keyCode == 13 || e.type == 'keyup') { // Kiểm tra nếu phím nhấn là Enter hoặc "keyup" event
        qrcode.clear();
        makeCode1();
    }
});

// Gọi makeCode1() lần đầu tiên để tạo mã QR ban đầu
makeCode1();
