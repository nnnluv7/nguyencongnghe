
  
sanphamElement = document.getElementById('sanpham');
tile6thangthangElement = document.getElementById('tile6thang');
tile12thangthangElement = document.getElementById('tile12thang');
thanhtien6thangElement = document.getElementById('thanhtien6thang');
thanhtien12thangElement = document.getElementById('thanhtien12thang');
moithang6Element = document.getElementById('moithang6');
moithang12Element = document.getElementById('moithang12');
phi25Element = document.getElementById('phi25');

// Tính tỉ lệ phí bảo heiẻm
function getStringTiLe6(a) {
if (a == 1) {
    return '5.96% x Giá Máy'
} else if (a == 2) {
    return '5.92% x Giá Máy'
} else {
    return '5.16% x Giá Máy'
}
}

function getTiLe6(a) {

if (a == 1) {
    return 5.96/100
} else if (a == 2) {
    return 5.92/100
} else {
    return 5.16/100
}
}


function getStringTiLe12(a) {

if (a == 1) {
    return '9.93% x Giá Máy'
} else if (a == 2) {
    return '9.87% x Giá Máy'
} else {
    return '8.6% x Giá Máy'
}
}

function getTiLe12(a) {

if (a == 1) {
    return 9.93/100
} else if (a == 2) {
    return 9.87/100
} else {
    return 8.6/100
}
}

function roundNega(num, numToRound) {
    let numToRoundString = '1'
     for( i = 0; i<numToRound; i++) {
       numToRoundString += 0
     }
     
     numToRound = Number(numToRoundString)
     
     num = num / numToRound
     num = Math.round(num)
      return num * numToRound
    }  

// Format phân cách phần nghìn
function formatNum(x) {
  return Number(x).toLocaleString();
}
  
function formatInput(input) {
    const inputValue = input.value.replace(/[\.,]/g, '');
    const formattedValue = Number(inputValue).toLocaleString();
    input.value = formattedValue;
    updateTotal();
  }   


function updateTotal() {

  let giaMay = parseInt(document.getElementById('giamay').value.replace(/[\.,]/g, '')) || 0;
  phi25Element.value = formatNum(roundNega(Math.round(giaMay * 0.25),3));

  if (sanphamElement.value == 1) {
  tile6thangthangElement.value = '5.96% x Giá Máy';
  tile12thangthangElement.value = '9.93% x Giá Máy';
  thanhtien6thangElement.value = formatNum(roundNega(Math.round(5.96 / 100 * giaMay),3));
  thanhtien12thangElement.value = formatNum(roundNega(Math.round(9.93 / 100 * giaMay),3));
  moithang6Element.value = formatNum(roundNega(Math.round(5.96 / 100 * giaMay)/6,3));
  moithang12Element.value = formatNum(roundNega(Math.round(9.93 / 100 * giaMay)/12,3)); 

  } else if (sanphamElement.value == 2) {
  tile6thangthangElement.value = '5.92% x Giá Máy';
  tile12thangthangElement.value = '9.87% x Giá Máy'
  thanhtien6thangElement.value = formatNum(roundNega(Math.round(5.92 / 100 * giaMay),3));
  thanhtien12thangElement.value = formatNum(roundNega(Math.round(9.87 / 100 * giaMay),3));
  moithang6Element.value = formatNum(roundNega(Math.round(5.92 / 100 * giaMay)/6,3));
  moithang12Element.value = formatNum(roundNega(Math.round(9.87 / 100 * giaMay)/12,3)); 

  } else {
  tile6thangthangElement.value = '5.16% x Giá Máy';
  tile12thangthangElement.value = '8.6% x Giá Máy';
  thanhtien6thangElement.value = formatNum(roundNega(Math.round(5.16 / 100 * giaMay),3));
  thanhtien12thangElement.value = formatNum(roundNega(Math.round(8.6 / 100 * giaMay),3));
  moithang6Element.value = formatNum(roundNega(Math.round(5.16 / 100 * giaMay)/6,3));
  moithang12Element.value = formatNum(roundNega(Math.round(8.6 / 100 * giaMay)/12,3)); 

  }  
}

