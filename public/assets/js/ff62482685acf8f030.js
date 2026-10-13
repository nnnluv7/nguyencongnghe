
  

var qrcode2 = new QRCode("qrcode2");

function makeCode2 () {		
	var elText2 = document.getElementById("text");			
	qrcode2.makeCode(elText2.value + '-P-1');
}

makeCode2();

$("#text").
	on("keyup", function () {
		makeCode2();
	}).
	on("keyup", function (e) {
		if (e.keyCode == 13) {
			makeCode2();
		}
	});
