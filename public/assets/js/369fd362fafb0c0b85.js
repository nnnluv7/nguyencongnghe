
      
  
function formatInput(input) {
    const inputValue = input.value.replace(/[\.,]/g, '');
    const formattedValue = Number(inputValue).toLocaleString();
    input.value = formattedValue;
    updateTotal();
  } 
  
  
    // Tính tỉ lệ phí theo số kỳ góp
function checkTiLe(a) {
      a = +a
      if (a < 7) {
          return 2.6/100
      } else if (a === 7 || a === 8 || a === 9) {
          return 2.9/100
      } else if (a > 9) {
          return 3.5/100
      }
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
    const phiThuHo = document.getElementById('phidongtien').value;  
    let giaMay = parseInt(document.getElementById('giamay').value.replace(/[\.,]/g, '')) || 0;
    let tiLeTraTruoc = parseInt(document.getElementById('tiletratruoc').value.replace(/[\.,]/g, '')) || 0;
    let kieuTraTruoc = document.getElementById('typett').value;
    let soTienTraTruoc = document.getElementById('sotientratruoc').value.replace(/[\.,]/g, '') || 0;
    let noLai = parseInt(document.getElementById('nolai').value.replace(/[\.,]/g, '')) || 0;
    let laiSuat = document.getElementById('laisuat').value || 0;
    let soKy = document.getElementById('goi').value;
    let phiTrachNhiem = parseInt(document.getElementById('phitrachnhiem').value.replace(/[\.,]/g, '')) || 0;
    let checkPhiTrachNhiem = document.getElementById('answer').value;
    let khac = parseInt(document.getElementById('khac').value.replace(/[\.,]/g, '')) || 0;
    let gopMoiThang = parseInt(document.getElementById('gopmoithang').value.replace(/[\.,]/g, '')) || 0;
    let tongTienPhaiTra = parseInt(document.getElementById('tongtienphaitra').value.replace(/[\.,]/g, '')) || 0;
    let chenhLech = parseInt(document.getElementById('chenhlech').value.replace(/[\.,]/g, '')) || 0;
    let tile = checkTiLe(soKy);
  	
    tiLeTraTruoc = kieuTraTruoc === 'no' ? tiLeTraTruoc : (tiLeTraTruoc/100);
  	let TraTruoc = kieuTraTruoc === 'no' ? tiLeTraTruoc : roundNega(giaMay * tiLeTraTruoc, -3);
    noLai = giaMay - TraTruoc;
    let tienLai = roundNega(noLai * (laiSuat/100),-3);
    gopMoiThang = roundNega(noLai / soKy, -3) + +tienLai + +phiThuHo;
    phiTrachNhiem = noLai <= 5000000 ? roundNega(5000000*tile, -3) : roundNega(noLai*tile, -3);
  	soTienTraTruoc = checkPhiTrachNhiem === 'no' ? roundNega(TraTruoc + +khac, -3) : roundNega(TraTruoc + phiTrachNhiem + +khac, -3);  
    tongTienPhaiTra = (gopMoiThang*soKy) + soTienTraTruoc;
    chenhLech = tongTienPhaiTra - +giaMay;
      
    document.getElementById('giamay').value = giaMay.toLocaleString();
    document.getElementById('sotientratruoc').value = soTienTraTruoc.toLocaleString();
    document.getElementById('nolai').value = noLai.toLocaleString();
    document.getElementById('phitrachnhiem').value = phiTrachNhiem.toLocaleString();
    document.getElementById('khac').value = khac.toLocaleString();
    document.getElementById('gopmoithang').value = gopMoiThang.toLocaleString();
    document.getElementById('tongtienphaitra').value = tongTienPhaiTra.toLocaleString();
    document.getElementById('chenhlech').value = chenhLech.toLocaleString();
}

    