
  
function formatInput(input) {
    const inputValue = input.value.replace(/[\.,]/g, '');
    const formattedValue = Number(inputValue).toLocaleString();
    input.value = formattedValue;
    updateTotal();
  }
  function updateTotal() {
    const qty500k = parseInt(document.getElementById('qty500k').value.replace(/[\.,]/g, '')) || 0;
    const qty200k = parseInt(document.getElementById('qty200k').value.replace(/[\.,]/g, '')) || 0;
    const qty100k = parseInt(document.getElementById('qty100k').value.replace(/[\.,]/g, '')) || 0;
    const qty50k = parseInt(document.getElementById('qty50k').value.replace(/[\.,]/g, '')) || 0;
    const qty20k = parseInt(document.getElementById('qty20k').value.replace(/[\.,]/g, '')) || 0;
    const qty10k = parseInt(document.getElementById('qty10k').value.replace(/[\.,]/g, '')) || 0;
    const qty5k = parseInt(document.getElementById('qty5k').value.replace(/[\.,]/g, '')) || 0;
    const qty2k = parseInt(document.getElementById('qty2k').value.replace(/[\.,]/g, '')) || 0;
    const qty1k = parseInt(document.getElementById('qty1k').value.replace(/[\.,]/g, '')) || 0;
    const qty5 = parseInt(document.getElementById('qty5').value.replace(/[\.,]/g, '')) || 0;


    const total500k = qty500k * 500000;
    const total200k = qty200k * 200000;
    const total100k = qty100k * 100000;
    const total50k = qty50k * 50000;
    const total20k = qty20k * 20000;
    const total10k = qty10k * 10000;
    const total5k = qty5k * 5000;
    const total2k = qty2k * 2000;
    const total1k = qty1k * 1000;
    const total5 = qty5 * 500;

    // Tính tổng cộng
    const grandTotal = total500k + total200k + total100k + total50k + total20k + total10k + total5k + total2k + total1k + total5;

    // Hiển thị tổng tiền cho từng loại tiền
    document.getElementById('total500k').innerText = total500k.toLocaleString();
    document.getElementById('total200k').innerText = total200k.toLocaleString();
    document.getElementById('total100k').innerText = total100k.toLocaleString();
    document.getElementById('total50k').innerText = total50k.toLocaleString();
    document.getElementById('total20k').innerText = total20k.toLocaleString();
    document.getElementById('total10k').innerText = total10k.toLocaleString();
    document.getElementById('total5k').innerText = total5k.toLocaleString();
    document.getElementById('total2k').innerText = total2k.toLocaleString();
    document.getElementById('total1k').innerText = total1k.toLocaleString();
    document.getElementById('total5').innerText = total5.toLocaleString();


    const danggiu = document.getElementById('danggiu').value.replace(/[\.,]/g, '');
    const chenhlech = grandTotal - danggiu;
    document.getElementById('chenhlech').innerText = chenhlech.toLocaleString();
    document.getElementById('grandTotal').innerText = grandTotal.toLocaleString();
  }

  updateTotal();
  
var inputx = document.getElementsByClassName("input-soluong");

for (var i = 0; i < inputx.length; i++) {
    inputx[i].addEventListener("click", function() {
        this.select(); // Chọn toàn bộ nội dung trong ô input khi click
    });
}

