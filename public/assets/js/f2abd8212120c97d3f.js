
    
    // Tạo một đối tượng chứa các ký tự có dấu và không dấu tương ứng
  var charMap = {
    "á": "a",
    "à": "a",
    "ả": "a",
    "ã": "a",
    "ạ": "a",
    "ă": "a",
    "ắ": "a",
    "ằ": "a",
    "ẳ": "a",
    "ẵ": "a",
    "ặ": "a",
    "â": "a",
    "ấ": "a",
    "ầ": "a",
    "ẩ": "a",
    "ẫ": "a",
    "ậ": "a",
    "đ": "d",
    "é": "e",
    "è": "e",
    "ẻ": "e",
    "ẽ": "e",
    "ẹ": "e",
    "ê": "e",
    "ế": "e",
    "ề": "e",
    "ể": "e",
    "ễ": "e",
    "ệ": "e",
    "í": "i",
    "ì": "i",
    "ỉ": "i",
    "ĩ": "i",
    "ị": "i",
    "ó": "o",
    "ò": "o",
    "ỏ": "o",
    "õ": "o",
    "ọ": "o",
    "ô": "o",
    "ố": "o",
    "ồ": "o",
    "ổ": "o",
    "ỗ": "o",
    "ộ": "o",
    "ơ": "o",
    "ớ": "o",
    "ờ": "o",
    "ở": "o",
    "ỡ": "o",
    "ợ": "o",
    "ú": "u",
    "ù": "u",
    "ủ": "u",
    "ũ": "u",
    "ụ": "u",
    "ư": "u",
    "ứ": "u",
    "ừ": "u",
    "ử": "u",
    "ữ": "u",
    "ự": "u",
    "ý": "y",
    "ỳ": "y",
    "ỷ": "y",
    "ỹ": "y",
    "ỵ": "y",
    ".": "",
    "!": "",
    "~": "",
    "@": "",
    "#": "",
    "$": "",
    "%": "",
    "^": "",
    "&": "",
    "*": "",
    "(": "",
    ")": "",
    "/": "",
    "\\": "",
    ",": "",
    "[": "",
    "]": "",
    "?": "",
    ">": "",
    "<": "",
    "{": "",
    "}": "",
    "=": "",
    "+": "",
    ":": "",
    "\"": "",
    "-": ""
  
  };
  
  function convert(str) {
    var result = "";
    for (var i = 0; i < str.length; i++) {
      var char = str[i];
      if (charMap.hasOwnProperty(char)) {
        result += charMap[char];
      } else {
        result += char;
      }
    }
    return result;
  }
  
  function convertAndJoin(str) {
    var converted = convert(str);
    var words = converted.split(" ");
    var joined = words.join("-");
    return joined;
  }
    
  var input = document.getElementById("text-input");
  var output = document.getElementById("text-output");
  input.addEventListener("input", function() {
    var text = input.value;
    var result = convertAndJoin(text);
    output.textContent = result;
  });  
    
    
    
  document.getElementById('copyButton').addEventListener('click', function() {
              var textToCopy = document.getElementById('text-output').innerText;
              var textarea = document.createElement('textarea');
              textarea.value = textToCopy;
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
              var notification = document.getElementById('notification');
              notification.style.display = 'block';
              setTimeout(function() {
                  notification.style.display = 'none';
              }, 2000);
          });  
  
  