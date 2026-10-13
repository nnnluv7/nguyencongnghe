
      
  
function formatInput(input) {
    const inputValue = input.value.replace(/[\.,]/g, '');
    const formattedValue = Number(inputValue).toLocaleString();
    input.value = formattedValue;
    updateTotal();
  }
  
 
  
    
    // Làm tròn số ngược
function roundNega(number, digits) {
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
    


      
function updateTotal() {
  	let phi;
	let nhomHang = document.getElementById('nhomhang').value;
  	let giaMay = parseInt(document.getElementById('giamay').value.replace(/[\.,]/g, '')) || 0;
    let giamGia = parseInt(document.getElementById('giamgia').value.replace(/[\.,]/g, '')) || 0;
  	let giamGiaPVI = parseInt(document.getElementById('giamgiapvi').value.replace(/[\.,]/g, '')) || 0;
    let soTien = parseInt(document.getElementById('sotien').value.replace(/[\.,]/g, '')) || 0;
  	let soTienPVI = parseInt(document.getElementById('sotienpvi').value.replace(/[\.,]/g, '')) || 0;
  	let tiLeGiam = giamGia/100;
  	let tiLeGiamPVI = giamGiaPVI/100;
    let soTien1 = roundNega(0.0454*giaMay*tiLeGiam,-3)
    let soTien1PVI
  	soTien = roundNega(0.0462*giaMay,-3) - soTien1 <200000 ? 200000 : roundNega(0.0454*giaMay,-3) - soTien1;
	
  	

    if (nhomHang === "1") {
        phi = 0.0462;
      	soTien1PVI = roundNega(phi*giaMay*tiLeGiamPVI,-3)
      	soTienPVI = roundNega(phi*giaMay,-3) - soTien1PVI <200000 ? 200000 : roundNega(phi*giaMay,-3) - soTien1PVI;
      
    } else if (nhomHang === "2") {
      	phi = 0.06;
        soTien1PVI = roundNega(phi*giaMay*tiLeGiamPVI,-3)
      	soTienPVI = roundNega(phi*giaMay,-3) - soTien1PVI <200000 ? 200000 : roundNega(phi*giaMay,-3) - soTien1PVI;
    } else if (nhomHang === "3") {
      	phi = 0.06;
        soTien1PVI = roundNega(phi*giaMay*tiLeGiamPVI,-3)
      	soTienPVI = roundNega(phi*giaMay,-3) - soTien1PVI; 
    } else if (nhomHang === "4") {
      	phi = 0.06;
        soTien1PVI = roundNega(phi*giaMay*tiLeGiamPVI,-3)
      	soTienPVI = roundNega(phi*giaMay,-3) - soTien1PVI <100000 ? 100000 : roundNega(phi*giaMay,-3) - soTien1PVI;  
    } else if (nhomHang === "5") {
        phi = 0.07;
        soTien1PVI = roundNega(phi*giaMay*tiLeGiamPVI,-3)
      	soTienPVI = roundNega(phi*giaMay,-3) - soTien1PVI; 
    }
  
  	
      
    document.getElementById('giamay').value = giaMay.toLocaleString();
    document.getElementById('giamgia').value = giamGia.toLocaleString();
    document.getElementById('sotien').value = soTien.toLocaleString();
  	document.getElementById('giamgiapvi').value = giamGiaPVI.toLocaleString();
    document.getElementById('sotienpvi').value = soTienPVI.toLocaleString();
}
  
  
function updateDisplay() {
            const selectBox = document.getElementById("ctybaohiem");
            const pviDiv = document.querySelector(".pvi");
            const brightDiv = document.querySelector(".bright");

            if (selectBox.value === "1") {
                pviDiv.style.display = "block";
                brightDiv.style.display = "none";
            } else if (selectBox.value === "2") {
                pviDiv.style.display = "none";
                brightDiv.style.display = "block";
            }
        }  

