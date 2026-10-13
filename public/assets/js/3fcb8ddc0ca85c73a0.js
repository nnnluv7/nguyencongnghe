
  
  
  document.addEventListener("DOMContentLoaded", function() {
    var printButton = document.getElementById("print-button");

    if (printButton) {
        printButton.addEventListener("click", function(event) {
            var buttonRect = printButton.getBoundingClientRect();
            var afterWidth = 135; // Chiều rộng của pseudo-element ::after (50px + 5px padding)
            var afterHeight = 40; // Chiều cao của pseudo-element ::after

            var afterRect = {
                top: buttonRect.top,
                bottom: buttonRect.top + afterHeight,
                left: buttonRect.right - afterWidth,
                right: buttonRect.right
            };

            if (event.clientX >= afterRect.left && event.clientX <= afterRect.right &&
                event.clientY >= afterRect.top && event.clientY <= afterRect.bottom) {
                window.print();
            }
        });
    }
});

  
  function setCurrentDate() {
  var currentDate = new Date();
  var day = currentDate.getDate();
  var month = currentDate.getMonth() + 1; // Tháng bắt đầu từ 0
  var formattedDate = (day < 10 ? '0' : '') + day + '/' + (month < 10 ? '0' : '') + month;

  document.getElementById('ff1').value = formattedDate;
  document.getElementById('ff2').value = formattedDate;
  document.getElementById('ff3').value = formattedDate;
  document.getElementById('ff4').value = formattedDate;
  document.getElementById('ff5').value = formattedDate;
  document.getElementById('ff6').value = formattedDate;
  document.getElementById('ff7').value = formattedDate;
  }

  
  
  var ff1e = document.getElementById('ff1');
  var mau1e = document.getElementById('mau1');
  var ver1e = document.getElementById('ver1');
  var sl1 = document.getElementById('sl1').value;
  var cot1 = document.getElementById('cot1');

  function fcot1() {
    const ff1 = ff1e.value;
    const mau1 = mau1e.value;
    const ver1 = ver1e.value;

    cot1.value = ff1 + "\r\n" + mau1 + "\r\n" + ver1;
  }

  var ff2e = document.getElementById('ff2');
  var mau2e = document.getElementById('mau2');
  var ver2e = document.getElementById('ver2');
  var sl2 = document.getElementById('sl2').value;
  var cot2 = document.getElementById('cot2');

  function fcot2() {
    const ff2 = ff2e.value;
    const mau2 = mau2e.value;
    const ver2 = ver2e.value;

    cot2.value = ff2 + "\r\n" + mau2 + "\r\n" + ver2;
  }

  var ff3e = document.getElementById('ff3');
  var mau3e = document.getElementById('mau3');
  var ver3e = document.getElementById('ver3');
  var sl3 = document.getElementById('sl3').value;
  var cot3 = document.getElementById('cot3');

  function fcot3() {
    const ff3 = ff3e.value;
    const mau3 = mau3e.value;
    const ver3 = ver3e.value;

    cot3.value = ff3 + "\r\n" + mau3 + "\r\n" + ver3;
  }

  var ff4e = document.getElementById('ff4');
  var mau4e = document.getElementById('mau4');
  var ver4e = document.getElementById('ver4');
  var sl4 = document.getElementById('sl4').value;
  var cot4 = document.getElementById('cot4');

  function fcot4() {
    const ff4 = ff4e.value;
    const mau4 = mau4e.value;
    const ver4 = ver4e.value;

    cot4.value = ff4 + "\r\n" + mau4 + "\r\n" + ver4;
  }

  var ff5e = document.getElementById('ff5');
  var mau5e = document.getElementById('mau5');
  var ver5e = document.getElementById('ver5');
  var sl5 = document.getElementById('sl5').value;
  var cot5 = document.getElementById('cot5');

  function fcot5() {
    const ff5 = ff5e.value;
    const mau5 = mau5e.value;
    const ver5 = ver5e.value;

    cot5.value = ff5 + "\r\n" + mau5 + "\r\n" + ver5;
  }

  var ff6e = document.getElementById('ff6');
  var mau6e = document.getElementById('mau6');
  var ver6e = document.getElementById('ver6');
  var sl6 = document.getElementById('sl6').value;
  var cot6 = document.getElementById('cot6');

  function fcot6() {
    const ff6 = ff6e.value;
    const mau6 = mau6e.value;
    const ver6 = ver6e.value;

    cot6.value = ff6 + "\r\n" + mau6 + "\r\n" + ver6;
  }

  var ff7e = document.getElementById('ff7');
  var mau7e = document.getElementById('mau7');
  var ver7e = document.getElementById('ver7');
  var sl7 = document.getElementById('sl7').value;
  var cot7 = document.getElementById('cot7');

  function fcot7() {
    const ff7 = ff7e.value;
    const mau7 = mau7e.value;
    const ver7 = ver7e.value;

    cot7.value = ff7 + "\r\n" + mau7 + "\r\n" + ver7;
  }

  function generateFifoArray() {
    var fifoValue1 = document.getElementById('cot1').value;
    var fifoValue2 = document.getElementById('cot2').value;
    var fifoValue3 = document.getElementById('cot3').value;
    var fifoValue4 = document.getElementById('cot4').value;
    var fifoValue5 = document.getElementById('cot5').value;
    var fifoValue6 = document.getElementById('cot6').value;
    var fifoValue7 = document.getElementById('cot7').value;

    var quantityValue1 = parseInt(document.getElementById('sl1').value) || 0;
    var quantityValue2 = parseInt(document.getElementById('sl2').value) || 0;
    var quantityValue3 = parseInt(document.getElementById('sl3').value) || 0;
    var quantityValue4 = parseInt(document.getElementById('sl4').value) || 0;
    var quantityValue5 = parseInt(document.getElementById('sl5').value) || 0;
    var quantityValue6 = parseInt(document.getElementById('sl6').value) || 0;
    var quantityValue7 = parseInt(document.getElementById('sl7').value) || 0;

    var fifoArray1 = new Array(quantityValue1).fill(fifoValue1);
    var fifoArray2 = new Array(quantityValue2).fill(fifoValue2);
    var fifoArray3 = new Array(quantityValue3).fill(fifoValue3);
    var fifoArray4 = new Array(quantityValue4).fill(fifoValue4);
    var fifoArray5 = new Array(quantityValue5).fill(fifoValue5);
    var fifoArray6 = new Array(quantityValue6).fill(fifoValue6);
    var fifoArray7 = new Array(quantityValue7).fill(fifoValue7);

    var combinedArray = []

    combinedArray = fifoArray1.concat(fifoArray2, fifoArray3, fifoArray4, fifoArray5, fifoArray6, fifoArray7);

    var cellDivs = document.querySelectorAll('.cell');
    cellDivs.forEach(function (div, index) {
      var textarea = div.querySelector('textarea');
      if (combinedArray[index] !== undefined) {
        textarea.value = combinedArray[index];
      } else {
        textarea.value = '';
      }
    });
  }
  function inputcot1() {
    fcot1();
    generateFifoArray();
  }

  function inputcot2() {
    fcot2();
    generateFifoArray();
  }

  function inputcot3() {
    fcot3();
    generateFifoArray();
  }

  function inputcot4() {
    fcot4();
    generateFifoArray();
  }

  function inputcot5() {
    fcot5();
    generateFifoArray();
  }

  function inputcot6() {
    fcot6();
    generateFifoArray();
  }

  function inputcot7() {
    fcot7();
    generateFifoArray();
  }
  
  setCurrentDate();
  inputcot1();
  inputcot2();
  inputcot3();
  inputcot4();
  inputcot5();
  inputcot6();
  inputcot7();
  
