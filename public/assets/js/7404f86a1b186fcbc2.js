

// Hàm đếm số từ trong một chuỗi
function countWords(str) {
  // Loại bỏ các khoảng trắng thừa ở đầu và cuối chuỗi
  str = str.trim();
  // Nếu chuỗi rỗng, trả về 0
  if (str.length == 0) {
    return 0;
  }
  // Ngược lại, tách chuỗi theo các khoảng trắng và trả về độ dài của mảng kết quả
  return str.split(/\s+/).length;
}

// Lấy phần tử input có id là "text-input"
var input = document.getElementById("text-input");
// Lấy phần tử span có id là "word-count"
var output = document.getElementById("word-count");
// Thêm sự kiện input cho phần tử input
input.addEventListener("input", function() {
  // Lấy giá trị của input
  var text = input.value;
  // Đếm số từ trong input
  var words = countWords(text);
  // Hiển thị số từ trong output
  output.textContent = words;
});

