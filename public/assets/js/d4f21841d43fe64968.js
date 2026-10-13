
//<![CDATA[
var keywordsHideTag = ["Tắt sidebar", "PrintMWG", "private", "post", "ontop", "trend", "Căn giữa tiêu đề", "Tắt bình luận", "Tắt xem thêm", "Tắt share", "Tắt Breadcrum", "Tắt đầu bài", "Tắt nhãn", "Tắt ad trên", "Tắt ad dưới"];
var tags = document.getElementsByClassName("label-link");
    for (var i = 0; i < tags.length; i++) {
       var content = tags[i].innerHTML;
       if (keywordsHideTag.includes(content)) {
       tags[i].style.display = "none";
            }
          }

var keywordsFix = ["Fix-Title"];

          var tags = document.getElementsByClassName("label-link");
          for (var i = 0; i < tags.length; i++) {
            var content = tags[i].innerHTML;
            if (keywordsFix.includes(content)) {
              document.querySelector(".fix-title").style.display = "none";
            }
          }


var keywords = ["PrintMWG"];
          var tags = document.getElementsByClassName("label-link");
          for (var i = 0; i < tags.length; i++) {
            var content = tags[i].innerHTML;
            if (keywords.includes(content)) {

	// Hiển thị widget theo tag
			  document.querySelector("#HTML5").style.display = "block";
              document.querySelector("#HTML4").style.display = "block";
              document.querySelector("#HTML19").style.display = "none";
			}
		}

var table = {
    "thu-thuat": "Thủ thuật",
    "huong-dan": "Hướng dẫn",
	"giai-tri": "Giải trí",
    "tin-tuc-bao-moi": "Tin Tức",
    "tin-tuc-cong-nghe": "Tin Tức Công Nghệ",
    "ung-dung-windows": "Ứng dụng Windows",
    "ung-dung-android": "Ứng dụng Android",
    "ung-dung-ios": "Ứng dụng iOS",
    "ung-dung-macos": "Ứng dụng MacOS"
};

var classes = [".b-label", ".label-link", ".query-info"];

classes.forEach(function(className) {
    var elements = document.querySelectorAll(className);
    elements.forEach(function(element) {
        var content = element.innerHTML.trim();
        if (content in table) {
            element.innerHTML = table[content];
        }
    });
});


var table2 = {
    "Tắt bình luận": "comments-section",
    "Tắt xem thêm": "post-footer",
    "Tắt share": "feed-share",
    "Tắt Breadcrum": "breadcrumz",
    "Tắt đầu bài": "all-flex",
    "Tắt nhãn": "label-container",
    "Tắt ad trên": "top-ads",
    "Tắt ad dưới": "below-ads",
    "Tắt tiêu đề": "h1.entry-title",
	"Tắt sidebar": "sidebar-cover",
	"Tắt footer": "flex-footer"
};

var labels = document.querySelectorAll('.label-link');
labels.forEach(function(label) {
    if (label.textContent.includes("Căn giữa tiêu đề")) {
        var title = document.querySelector('h1.entry-title');
        title.classList.add("can-giua");
    }
});
labels.forEach(function(label) {
    for (var keyword in table2) {
		if (label.textContent.includes(keyword)) {
            var classToHide = table2[keyword];
            var elementsToHide;
            if (classToHide.startsWith("h1.")) {
                elementsToHide = document.querySelectorAll(classToHide);
            } else {
                elementsToHide = document.getElementsByClassName(classToHide);
            }
            for (var i = 0; i < elementsToHide.length; i++) {
                elementsToHide[i].classList.add("hide");
            }
        }
    }
});


var links = document.querySelectorAll('div.separator > a');
links.forEach(function(link) {
    link.setAttribute('href', '#');
	link.addEventListener('mouseover', function() {
        this.style.cursor = 'default';
    });
});


//]]>
