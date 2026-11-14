import {insuranceLogo, warrantyFontCSS, warrantyFontFamily, withWarrantyFonts} from './warranty-assets.js';

// Layout and installation prices follow the supplied Điện Máy Xanh form.
const id='sales-bh-giao-hang';
const model={
 id,name:'BẢO HÀNH · GIAO HÀNG',section:'sales',group:'ban-hang',
 thumbnail:'/assets/ncn-store-tools/sales/delivery-preview-6c0595504f.webp',
 note:'2 phiếu trên A4 ngang hoặc 1 phiếu trên A5 dọc',variants:[{layout:id,size:'A4 / A5'}]
};

const field=(label,maxLength,example)=>({label,type:'text',fontSize:12.5,maxLength,example,placeholder:''});
const layout={
 id,defaultPaper:'A4',defaultOrientation:'landscape',perPage:1,a5Cut:true,fontCSS:warrantyFontCSS,
 fields:[
  field('Bảo hành (năm)',6,'2'),
  field('Bảo hành remote',26,'12 tháng'),
  field('Tên khách hàng',42,'Nguyễn Thị Mai'),
  field('Số điện thoại',17,'0900000000'),
  field('Giờ giao hàng',27,'09:00 đến 11:00'),
  field('Ngày giao hàng',18,'dd/mm/yyyy')
 ],
 prototype:`
<article class="delivery-slip">
  <header class="delivery-header">
    <img src="${insuranceLogo}" alt="Điện Máy Xanh" width="1227" height="148">
    <strong>TỔNG ĐÀI BẢO HÀNH: 1900232465</strong>
  </header>
  <h1>CHÍNH SÁCH BẢO HÀNH VÀ PHIẾU HẸN GIAO HÀNG</h1>
  <div class="delivery-dashes" aria-hidden="true">-------------------</div>
  <p class="delivery-products">✍️Tivi, Loa, Tủ Lạnh, Máy Giặt, Máy Sấy, Máy Rửa Chén, Máy Lạnh, Máy Lọc Nước, Máy Nước Nóng (Mới)</p>
  <div class="delivery-warranty">
    <label>Bảo hành <input type="text" data-field="0"> <strong>năm.</strong></label>
    <label><strong>REMOTE BH</strong> <input type="text" data-field="1"></label>
  </div>
  <div class="delivery-remote">
    <p><strong>▸ LƯU Ý: REMOTE RỈ SÉT KHÔNG ÁP DỤNG BẢO HÀNH.</strong></p>
    <p>(Quý khách nên sử dụng pin tốt và kiểm tra thay pin thường xuyên)</p>
  </div>
  <div class="delivery-invoice"><strong class="delivery-box">HÓA ĐƠN CÔNG TY CHỈ XUẤT TRONG NGÀY</strong></div>

  <section class="delivery-defect">
    <h2>TRƯỜNG HỢP SẢN PHẨM BỊ LỖI</h2>
    <p><strong>Tháng 1.</strong> Sản phẩm chính lỗi do nhà sản xuất được đổi miễn phí máy mới cùng hàng, cùng model, màu sắc và thông số nếu đủ điều kiện.</p>
    <p>*Điều kiện đổi: Máy không trầy xước, cấn móp còn nguyên vẹn đủ điều kiện bảo hành của hãng.</p>
    <p class="delivery-options"><strong>Tháng 2 đến tháng ....</strong> Anh/chị <span class="delivery-name">{{field:2}}</span> có 3 lựa chọn</p>
    <ol>
      <li>Bảo hành cam kết 15 ngày cho sản phẩm chính đủ điều kiện. Nếu quá hạn hoặc phải bảo hành lại trong 30 ngày, giảm 50% phí đổi hoặc hoàn tiền theo chính sách.</li>
      <li>Đổi sản phẩm <strong>CÙNG MODEL</strong>, phí 10% giá trị hóa đơn/tháng từ tháng 2.</li>
      <li>Hoàn tiền, mất phí 20% tháng đầu và cộng 10% mỗi tháng tiếp theo theo chính sách.</li>
    </ol>
    <p class="delivery-accessories"><strong>ĐỐI VỚI PHỤ KIỆN ĐI KÈM.</strong> Phụ kiện lỗi sẽ gửi hãng bảo hành cam kết 15 ngày hoặc đủ điều kiện được đổi miễn phí bằng loại tương đương TGDĐ/ĐMX kinh doanh trong 12 tháng.</p>
  </section>

  <section class="delivery-return">
    <h2>NẾU SẢN PHẨM KHÔNG LỖI NHƯNG KHÁCH MUỐN ĐỔI HOẶC TRẢ</h2>
    <p class="delivery-first-month"><strong>▸ Tháng 1. Phí hoàn tiền <b>20%</b> giá trị hóa đơn.</strong></p>
    <p class="delivery-policy-note">(Thời gian sử dụng sản phẩm tính từ lúc xuất hàng. Quá 1 giờ vẫn tính là 1 tháng.)</p>
    <div class="delivery-fee-row">
      <strong>▸ Từ tháng 2</strong>
      <table class="delivery-fees" aria-label="Ví dụ phí hoàn tiền theo tháng">
        <thead><tr><th scope="col">T2</th><th scope="col">T3</th><th scope="col">T4</th><th scope="col">T5</th><th scope="col">T6</th><th scope="col">T7</th><th scope="col">T8</th></tr></thead>
        <tbody><tr><td>30%</td><td>40%</td><td>50%</td><td>60%</td><td>70%</td><td>80%</td><td>90%</td></tr></tbody>
      </table>
      <strong>Cộng thêm 10%<br>mỗi tháng</strong>
    </div>
    <p class="delivery-condition">▸ SẢN PHẨM ĐỔI, TRẢ CẦN CÒN NGUYÊN VẸN, ĐỦ ĐIỀU KIỆN BẢO HÀNH<br>VÀ HOÀN ĐỦ HỘP, PHỤ KIỆN, QUÀ TẶNG THEO QUY ĐỊNH.</p>
  </section>

  <section class="delivery-materials">
    <p>▸ VẬT TƯ PHÁT SINH khách thanh toán riêng khi có nhu cầu sử dụng.</p>
    <p>+ CB Panasonic 90.000đ/cái. + EKE 100.000đ/cặp. + Dây điện nguồn Ø 2,5 mm 30.000đ/mét. + Chân đế cao su máy lạnh (4 cái) 40.000đ/bộ.</p>
    <p class="delivery-copper">*** Phí ống đồng tùy công suất máy. 236.000đ, 270.000đ, 320.000đ hoặc 420.000đ/mét (ĐÃ GỒM DÂY ĐIỆN, ỐNG NƯỚC MỀM, QUẤN SIMILI, ĐÓNG MÓC ỐNG).</p>
    <p>* Phí lắp âm ống đồng trong tường/la phông cố định 70.000đ/mét.</p>
    <p class="delivery-material-item">➢ Khung treo tivi dưới 40 inch (200.000–300.000đ), 37–65 inch (350.000–400.000đ), 60–80 inch (450.000đ).</p>
    <div class="delivery-material-item delivery-confirm"><span>➢ Chân đế máy giặt 350.000–550.000đ</span><strong>XÁC NHẬN ĐÃ TƯ VẤN VẬT TƯ PHÁT SINH</strong></div>
  </section>

  <section class="delivery-appointment">
    <h2>THỜI GIAN HẸN GIAO HÀNG</h2>
    <label class="delivery-line">- Tên khách hàng <input type="text" data-field="2"></label>
    <label class="delivery-line delivery-phone">- SĐT <input type="text" data-field="3"></label>
    <div class="delivery-time"><strong>- Thời gian giao hàng</strong><label>Từ <input type="text" data-field="4"></label><label>Ngày <input type="text" data-field="5"></label></div>
  </section>
  <p class="delivery-hotline">BẢO HÀNH TẠI NHÀ GỌI SỐ <strong class="delivery-box">1900232465</strong></p>
</article>
`.trim(),
 css:`
.delivery-slip{min-width:0;width:100%;min-height:100%;padding:4mm 2mm 2mm;border:1mm double #000;background:#fff;color:#000;font:9.35pt/1.08 ${warrantyFontFamily}}
.delivery-slip p,.delivery-slip h2{margin:0}
.delivery-header{display:flex;align-items:center;justify-content:space-between;gap:1.2mm;margin:.2mm .7mm 4mm}
/* Show the Điện Máy Xanh half of the shared insurance logo. */
.delivery-header img{display:block;flex:none;width:33mm;height:8.1mm;object-fit:cover;object-position:right}
.delivery-header strong{font-size:14.8pt;line-height:1.05;white-space:nowrap}
.delivery-slip h1{margin:0;text-align:center;font-size:13.2pt;line-height:1.13}
.delivery-dashes{text-align:center;font-size:12pt;font-weight:700;line-height:1.04;margin:0 0 1.5mm}
.delivery-slip .delivery-products{font-size:12pt;font-weight:700;line-height:1.1}
.delivery-warranty,.delivery-line,.delivery-time,.delivery-time label,.delivery-warranty label{display:flex;align-items:baseline;gap:1mm;min-width:0}
.delivery-warranty{justify-content:center;margin:.3mm 0}
.delivery-warranty label{white-space:nowrap}
.delivery-slip input[type=text]{width:0;min-width:0;flex:1;padding:0 .25mm;border:0;border-bottom:.25mm dotted #000;background:transparent;color:inherit;font:inherit;font-weight:400;line-height:1.05}
.delivery-warranty label:first-child{width:48mm}
.delivery-warranty label:last-child{width:50mm}
.delivery-remote{text-align:center;font-size:9pt;margin:.55mm 0 1mm}
.delivery-remote p+p{margin-top:.45mm}
.delivery-invoice{text-align:center;margin:.9mm 0 1.6mm;font-size:12pt;line-height:1.08}
.delivery-box{display:inline-block;padding:0 .9mm;border:.28mm dashed #000}
.delivery-defect h2,.delivery-appointment h2{font-size:10pt;line-height:1.13;margin-bottom:.55mm}
.delivery-defect .delivery-options{font-weight:700;margin:.85mm 0 .35mm;text-indent:8mm;overflow-wrap:anywhere}
.delivery-name{display:inline-block;min-width:20mm;max-width:100%;border-bottom:.22mm dotted #000}
.delivery-defect ol{margin:0 0 .7mm;padding-left:7.5mm}
.delivery-defect .delivery-accessories{margin-bottom:.9mm;text-indent:8mm}
.delivery-return h2{font-size:9pt;text-decoration:underline;line-height:1.09;margin:0 0 .6mm}
.delivery-first-month,.delivery-policy-note{text-align:center;font-size:9pt}
.delivery-first-month b{font-size:11pt}
.delivery-fee-row{display:grid;grid-template-columns:minmax(18mm,1fr) 67mm minmax(23mm,1fr);gap:1.7mm;align-items:center;font-size:8.8pt;margin:.65mm 0 0}
.delivery-fee-row>strong:first-child{text-align:right}
.delivery-fees{width:100%;border-collapse:collapse;text-align:center;font-size:9pt;font-weight:700;table-layout:fixed}
.delivery-fees th,.delivery-fees td{border:.22mm solid #000;padding:.17mm 0}
.delivery-fees th{background:#eee}
.delivery-return .delivery-condition{text-align:center;font-size:8.85pt;font-weight:700;line-height:1.13;margin:1.4mm 0 1.2mm}
.delivery-materials{font-size:9.1pt;font-weight:700;line-height:1.08}
.delivery-copper{text-indent:2mm}
.delivery-materials .delivery-material-item{padding-left:5mm}
.delivery-confirm{display:flex;align-items:baseline;gap:2.5mm;margin-top:.2mm}
.delivery-confirm strong{font-size:7.25pt;text-decoration:underline}
.delivery-appointment{margin-top:1.2mm;font-weight:700}
.delivery-appointment label{white-space:nowrap}
.delivery-line{margin-bottom:.45mm}
.delivery-phone{width:53mm}
.delivery-time{flex-wrap:wrap;gap:1.1mm}
.delivery-time label{flex:1 0 30mm}
.delivery-slip .delivery-hotline{margin-top:1.4mm;font-weight:700}
.delivery-hotline strong{font-size:15.5pt;line-height:1.05}
`.trim()
};
export function withDeliveryTemplate(catalogue){
 return {...catalogue,models:[model,...catalogue.models],layouts:[layout,...catalogue.layouts],assets:withWarrantyFonts(catalogue.assets)};
}
