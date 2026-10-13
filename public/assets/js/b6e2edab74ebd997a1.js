
  
tenwifitext = document.getElementById('tenwifi');
loaiwifitext = document.getElementById('loaiwifi');
matkhautext = document.getElementById('matkhau');
submitcode =  document.getElementById('submitcode');
  				
var qrcode1 = new QRCode("qrcode1");

function makeCode() {    
  const tenwifix = tenwifitext.value;
  const matkhaux = matkhautext.value;
  const loaiwifix = loaiwifitext.value;
  
  if (loaiwifix == 1) {
    var textCode = "WIFI:T:WPA;P:" + matkhaux + ";S:" + tenwifix +";H:false;";
  } else {
    var textCode = " WIFI:S:" + tenwifix + ";T:nopass;P:;;";
  }  
  
  qrcode1.clear();
  qrcode1.makeCode(textCode);
}

