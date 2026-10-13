
      
giamayElement = document.getElementById('giamay');
sanphamElement = document.getElementById('sanpham');
giamgiaElenment = document.getElementById('giamgia');

sotien1namElement = document.getElementById('sotien1nam');
sotien2namElement = document.getElementById('sotien2nam');
  
  



var dienthoai1 = [90000,300000,550000,750000,1050000,1250000,1550000,2000000,2500000];
var dienthoai2 = [170000,570000,1050000,1450000,2000000,2380000,2950000,3800000,4750000];

var laptop1 = [280000,500000,700000,1050000,1250000,1550000,1900000,2400000,3400000];
var laptop2 = [530000,950000,1350000,2000000,2380000,2950000,3600000,4550000,6450000];

var tivi1 = [280000,500000,750000,1050000,1250000,1550000,2000000,2500000,4300000];
var tivi2 = [530000,950000,1450000,2000000,2380000,2950000,3800000,4750000,8150000];

var tulanh1 = [220000,390000,600000,880000,1100000,1200000,1550000,2000000,3100000];
var tulanh2 = [420000,740000,1150000,1680000,2100000,2300000,2950000,3800000,5900000];

var maygiat1 = [270000,440000,660000,950000,1200000,1450000,1750000,2200000,3300000];
var maygiat2 = [510000,850000,1250000,1800000,2300000,2750000,3350000,4200000,6300000];

var maylanh1 = [240000,420000,640000,920000,1150000,1300000,1650000,2100000,3200000];
var maylanh2 = [460000,800000,1250000,1750000,2300000,2500000,3150000,4000000,6100000];
  
 


function getPhiDienThoai(x) {
    if (x <= 2000000) {
        return 0
    } else if (x > 2000000 && x <= 5000000) {
        return 1
    } else if (x > 5000000 && x <= 10000000) {
        return 2
    } else if (x > 10000000 && x <= 15000000) {
        return 3
    } else if (x > 15000000 && x <= 20000000) {
        return 4
    } else if (x > 20000000 && x <= 25000000) {
        return 5
    } else if (x > 25000000 && x <= 30000000) {
        return 6
    } else if (x> 30000000 && x <= 40000000) {
        return 7
    } else if ((x> 40000000 && x <= 50000000)) {
        return 8
    }
}

function getPhiTivi(x) {
    if (x <= 5000000) {
        return 0
    } else if (x > 5000000 && x <= 10000000) {
        return 1
    } else if (x > 10000000 && x <= 15000000) {
        return 2
    } else if (x > 15000000 && x <= 20000000) {
        return 3
    } else if (x > 20000000 && x <= 25000000) {
        return 4
    } else if (x > 25000000 && x <= 30000000) {
        return 5
    } else if (x > 30000000 && x <= 40000000) {
        return 6
    } else if (x> 40000000 && x <= 50000000) {
        return 7
    } else if (x> 50000000 && x <= 100000000) {
        return 8
    }
}

function getPhiKhac(x) {
    if (x <= 5000000) {
        return 0
    } else if (x > 5000000 && x <= 10000000) {
        return 1
    } else if (x > 10000000 && x <= 15000000) {
        return 2
    } else if (x > 15000000 && x <= 20000000) {
        return 3
    } else if (x > 20000000 && x <= 25000000) {
        return 4
    } else if (x > 25000000 && x <= 30000000) {
        return 5
    } else if (x > 30000000 && x <= 40000000) {
        return 6
    } else if (x> 40000000 && x <= 50000000) {
        return 7
    } else if (x> 50000000 && x <= 80000000) {
        return 8
    }
}

function roundCustom(number, digits) {
    if (digits === undefined) {
        return Math.round(number);
    } else {
        var roundingFactor = Math.pow(10, Math.abs(digits));
        if (digits >= 0) {
            var roundedNumber = Math.round(number * roundingFactor) / roundingFactor;
            return roundedNumber;
        } else {
            var roundedNumber = Math.round(number / roundingFactor) * roundingFactor;
            return roundedNumber;
        }
    }
}

  
function formatNum(x) {
    return Intl.NumberFormat().format(x);  
}
  
function formatInput(input) {
    const inputValue = input.value.replace(/[\.,]/g, '');
    const formattedValue = Number(inputValue).toLocaleString();
    input.value = formattedValue;
    updateTotal();
  }   

function updateTotal() {
  let i = parseInt(document.getElementById('giamay').value.replace(/[\.,]/g, '')) || 0;
  var ii = sanphamElement.value;
  var y = giamgiaElenment.value/100;
    
  if (ii == 1) {        
  sotien1namElement.value = i < 1000000 ? "" : formatNum(dienthoai1[getPhiDienThoai(i)]-dienthoai1[getPhiDienThoai(i)]*y);
  sotien2namElement.value = i < 1000000 ? "" : formatNum(dienthoai2[getPhiDienThoai(i)]-dienthoai2[getPhiDienThoai(i)]*y);
  } else if (ii == 2) {
    
  sotien1namElement.value = i < 1000000 ? "" : formatNum(tivi1[getPhiTivi(i)]-tivi1[getPhiTivi(i)]*y);
  sotien2namElement.value = i < 1000000 ? "" : formatNum(tivi2[getPhiTivi(i)]-tivi2[getPhiTivi(i)]*y);

  } else if (ii == 3) {
    
  sotien1namElement.value = i < 1000000 ? "" : formatNum(laptop1[getPhiKhac(i)]-laptop1[getPhiKhac(i)]*y);
  sotien2namElement.value = i < 1000000 ? "" : formatNum(laptop2[getPhiKhac(i)]-laptop2[getPhiKhac(i)]*y);
  } else if (ii == 4) {
    
  sotien1namElement.value = i < 1000000 ? "" : formatNum(tulanh1[getPhiKhac(i)]-tulanh1[getPhiKhac(i)]*y);
  sotien2namElement.value = i < 1000000 ? "" : formatNum(tulanh2[getPhiKhac(i)]-tulanh2[getPhiKhac(i)]*y);
  } else if (ii == 5) {
    
  sotien1namElement.value = i < 1000000 ? "" : formatNum(maygiat1[getPhiKhac(i)]-maygiat1[getPhiKhac(i)]*y);
  sotien2namElement.value = i < 1000000 ? "" : formatNum(maygiat2[getPhiKhac(i)]-maygiat2[getPhiKhac(i)]*y);
  } else if (ii == 6) {
    
  sotien1namElement.value = i < 1000000 ? "" : formatNum(maylanh1[getPhiKhac(i)]-maylanh1[getPhiKhac(i)]*y);
  sotien2namElement.value = i < 1000000 ? "" : formatNum(maylanh2[getPhiKhac(i)]-maylanh2[getPhiKhac(i)]*y);
  } else if (ii == 7) {
  sotien1namElement.value = i*0.05 <70000 ? formatNum(roundCustom(70000-(70000*y),-3)) : formatNum(roundCustom((i*0.05) -(i*0.05*y),-3));
  sotien2namElement.value = i*0.08 <70000 ? formatNum(roundCustom(70000-(70000*y),-3)) : formatNum(roundCustom((i*0.08) -(i*0.08*y),-3));
  } 
  
}

 
    