
  
var qrcode1 = new QRCode("qrcode1");

function makeCode1 () {		
	var elText1 = document.getElementById("text");			
	qrcode1.makeCode(elText1.value);
}

makeCode1();

$("#text").
	on("keyup", function () {
		makeCode1();
	}).
	on("keyup", function (e) {
		if (e.keyCode == 13) {
			makeCode1();
		}
	});
