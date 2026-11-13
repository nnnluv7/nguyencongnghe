// Sales template transcribed from the supplied Điện Máy Xanh form.
const id='sales-bh-giao-hang',logo='/assets/ncn-store-tools/sales/delivery-logo.jpg';
const model={
 id,name:'BẢO HÀNH · GIAO HÀNG',section:'sales',group:'ban-hang',
 thumbnail:'/assets/ncn-store-tools/sales/delivery-preview.webp',
 note:'2 phiếu trên A4 ngang hoặc 1 phiếu trên A5 dọc',variants:[{layout:id,size:'A4 / A5'}]
};

const field=(label,maxLength,example)=>({label,type:'text',fontSize:12.4,maxLength,example,placeholder:''});
const layout={
 id,defaultPaper:'A4',defaultOrientation:'landscape',perPage:1,a5Cut:true,fontCSS:'',
 fields:[
  field('Bảo hành (năm)',6,'2'),
  field('Bảo hành remote',26,'12 tháng'),
  field('Tên khách hàng',42,'Nguyễn Thị Mai'),
  field('Số điện thoại',17,'0900000000'),
  field('Giờ giao hàng',27,'09:00–11:00'),
  field('Ngày giao hàng',18,'15/11/2026')
 ],
 prototype:`
<article class="delivery-slip">
  <header class="delivery-header">
    <img src="${logo}" alt="Điện Máy Xanh" width="383" height="91">
    <strong>TỔNG ĐÀI BẢO HÀNH 1900 232 465</strong>
  </header>
  <h1>CHÍNH SÁCH BẢO HÀNH VÀ PHIẾU HẸN GIAO HÀNG</h1>
  <p><strong>Tivi, tủ lạnh, máy giặt, máy lạnh, máy nước nóng (mới)</strong></p>
  <div class="delivery-pair"><label>Bảo hành <input type="text" data-field="0"> năm</label><label>Remote bảo hành <input type="text" data-field="1"></label></div>
  <p><strong>Lưu ý</strong> Remote rỉ sét không áp dụng bảo hành. Quý khách nên sử dụng pin tốt và kiểm tra thay pin thường xuyên.</p>
  <p class="delivery-invoice">HÓA ĐƠN CÔNG TY CHỈ XUẤT TRONG NGÀY</p>

  <h2>TRƯỜNG HỢP SẢN PHẨM BỊ LỖI</h2>
  <p><strong>Tháng 1.</strong> Nếu sản phẩm bị lỗi do nhà sản xuất, sẽ được đổi 1 sản phẩm mới cùng hàng, cùng màu, cùng model với sản phẩm đã mua (chỉ áp dụng cho thân máy).</p>
  <p><strong>Điều kiện đổi.</strong> Máy không trầy xước, không cấn móp, còn nguyên vẹn.</p>
  <p><strong>Tháng 2 đến tháng 24.</strong> Anh/chị <span class="delivery-name">{{field:2}}</span> có 3 lựa chọn.</p>
  <ol>
    <li>ĐMX chuyển hãng bảo hành trong 15 ngày.</li>
    <li>Đổi sản phẩm cùng model có mất phí 10%/tháng tính từ tháng thứ 2.</li>
    <li>Hoàn tiền mất phí 20% (tháng 1) + 10% mỗi tháng tiếp theo.</li>
  </ol>
  <p><strong>Phụ kiện đi kèm.</strong> Gửi hãng bảo hành trong 15 ngày hoặc đổi sản phẩm tương đương TGDĐ/ĐMX đang kinh doanh.</p>

  <h2>SẢN PHẨM KHÔNG BỊ LỖI NHƯNG KHÁCH MUỐN ĐỔI SẢN PHẨM KHÁC HOẶC TRẢ</h2>
  <p><strong>Tháng 1.</strong> Khách hàng mất phí sử dụng 20% trong tháng đầu tiên. Thời gian sử dụng tính từ lúc xuất hàng. Quá 1 giờ vẫn tính là 1 tháng. Từ tháng 2 cộng thêm 10% mỗi tháng.</p>
  <table class="delivery-fees" aria-label="Phí đổi hoặc trả theo tháng">
    <tbody><tr><th scope="row">Tháng</th><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td></tr>
    <tr><th scope="row">Phí</th><td>30%</td><td>40%</td><td>50%</td><td>60%</td><td>70%</td><td>80%</td><td>90%</td></tr></tbody>
  </table>
  <p class="delivery-condition">Sản phẩm không đủ điều kiện bảo hành không áp dụng đổi và trả. Sản phẩm cần còn đầy đủ phụ kiện đi kèm.</p>

  <h2>VẬT TƯ PHÁT SINH</h2>
  <p>Khách thanh toán riêng khi có nhu cầu sử dụng.</p>
  <ul>
    <li>CB Panasonic 90.000đ/cái, eke 100.000đ/cặp, dây điện nguồn Ø 2,5 mm 30.000đ/m, chân đế cao su máy lạnh (4 cái) 40.000đ/bộ.</li>
    <li>Ống đồng theo công suất 236.000đ, 270.000đ, 320.000đ hoặc 420.000đ/m. Đã gồm dây điện, ống nước mềm, quấn si và đóng móc ống.</li>
    <li>Lắp âm ống đồng trong tường hoặc la phông cố định 70.000đ/m.</li>
    <li>Khung treo tivi dưới 40 inch 200.000–300.000đ, 37–65 inch 350.000–400.000đ, 60–80 inch 450.000đ.</li>
    <li>Chân đế máy giặt 350.000–550.000đ.</li>
  </ul>
  <div class="delivery-confirm">Xác nhận đã tư vấn vật tư phát sinh <span></span></div>

  <section class="delivery-appointment">
    <h2>THỜI GIAN HẸN GIAO HÀNG</h2>
    <div class="delivery-pair"><label>Tên khách hàng <input type="text" data-field="2"></label></div>
    <div class="delivery-pair"><label>SĐT <input type="text" data-field="3"></label><label>Ngày giao <input type="text" data-field="5"></label></div>
    <div class="delivery-pair"><label>Giờ giao (từ – đến) <input type="text" data-field="4"></label></div>
    <p class="delivery-hotline">Bảo hành tại nhà gọi số <strong>1900 232 465</strong></p>
  </section>
</article>
`.trim(),
 css:`
.delivery-slip{min-width:0;width:100%;min-height:100%;border:.25mm solid #12222f;padding:2.6mm 3mm;background:#fff;color:#111;font:9.3pt/1.22 Arial,'Liberation Sans',sans-serif}
.delivery-header{display:flex;justify-content:space-between;align-items:center;gap:1.5mm;padding-bottom:1.3mm;border-bottom:.3mm solid #12222f;font-size:8.8pt}
.delivery-header img{width:29mm;height:auto;display:block}
.delivery-slip h1{font-size:12.2pt;line-height:1.14;text-align:center;margin:1.8mm 0 1.6mm;color:#0b2940}
.delivery-slip h2{font-size:9.5pt;line-height:1.16;margin:1.65mm 0 .55mm}
.delivery-slip p{margin:.55mm 0}
.delivery-slip ol,.delivery-slip ul{margin:.45mm 0 .65mm;padding-left:4.25mm}
.delivery-slip li{margin:.32mm 0}
.delivery-slip .delivery-invoice{font-weight:700;text-align:center;padding:.8mm 0;margin:1.1mm 0;border-block:.2mm solid #52616e}
.delivery-fees{width:100%;border-collapse:collapse;text-align:center;font-variant-numeric:tabular-nums;margin:.75mm 0}
.delivery-fees th,.delivery-fees td{border:.18mm solid #687580;padding:.32mm .5mm}
.delivery-slip .delivery-condition{font-weight:700}
.delivery-pair{display:flex;gap:2.2mm;margin:.4mm 0 .65mm}
.delivery-pair label{display:flex;align-items:baseline;gap:1.15mm;white-space:nowrap;flex:1;min-width:0}
.delivery-pair input{box-sizing:border-box;min-width:0;flex:1;width:0;max-width:100%;border:0;border-bottom:.2mm dotted #48515b;padding:0 .35mm;color:#111;background:transparent;font:inherit;line-height:1.15}
.delivery-slip>.delivery-pair label:first-child{max-width:43mm}
.delivery-appointment{border-top:.3mm solid #12222f;margin-top:1.6mm}
.delivery-appointment h2{margin-top:1.2mm}
.delivery-appointment label{font-weight:700}
.delivery-appointment input{font-weight:400}
.delivery-name{display:inline-block;min-width:24mm;border-bottom:.2mm dotted #48515b}
.delivery-confirm{display:flex;align-items:baseline;gap:1.5mm;font-size:8.8pt;margin:.7mm 0}
.delivery-confirm span{flex:1;border-bottom:.2mm dotted #48515b;min-height:.8em}
.delivery-slip .delivery-hotline{margin:1mm 0 0;text-align:center;font-size:9.4pt}
`.trim()
};
const asset={path:logo,mime:'image/jpeg',sha256:'9bf60b0eb3b9c10003a7941b4cea39de1aebabc86f9c6a093816fd9d4e625945',bytes:9277};

export function withDeliveryTemplate(catalogue){
 return {...catalogue,models:[model,...catalogue.models],layouts:[layout,...catalogue.layouts],assets:[asset,...catalogue.assets]};
}
