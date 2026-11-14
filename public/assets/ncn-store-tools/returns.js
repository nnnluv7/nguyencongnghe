const id='sales-doi-tra-bao-hanh';
const model={
 id,name:'ĐỔI TRẢ · BẢO HÀNH',section:'sales',group:'ban-hang',
 thumbnail:'/assets/ncn-store-tools/sales/returns-preview.webp',
 note:'2 phiếu trên A4 dọc hoặc 1 phiếu trên A5 ngang',
 variants:[{layout:id,size:'A4 / A5'}]
};

const layout={
 id,defaultPaper:'A4',defaultOrientation:'portrait',perPage:1,a5Cut:true,fields:[],fontCSS:'',
 prototype:`
<article class="returns-slip">
  <header class="returns-header">
    <img src="/assets/ncn-store-tools/sales/18003b4df479008ad390.png" width="1227" height="148" alt="Thế Giới Di Động và Điện Máy Xanh">
    <h1>CHÍNH SÁCH ĐỔI TRẢ VÀ BẢO HÀNH SẢN PHẨM</h1>
  </header>
  <table class="returns-table">
    <colgroup><col><col><col><col></colgroup>
    <thead>
    <tr>
      <th scope="col">
        <p>NHÓM HÀNG</p>
      </th>
      <th scope="col">
        <p>THÁNG ĐẦU TIÊN</p>
      </th>
      <th scope="col">
        <p>TỪ THÁNG THỨ 2 ĐẾN THÁNG 12</p>
      </th>
      <th scope="col">
        <p>GHI CHÚ</p>
      </th>
    </tr>
    </thead>
    <tbody>
    <tr>
      <th scope="row">
        <p>ĐIỆN TỬ<br>ĐIỆN LẠNH<br>ĐIỆN GIA DỤNG<br>LAPTOP</p>
        <p>TABLET<br>ĐIỆN THOẠI</p>
      </th>
      <td>
        <p><strong>Đổi mới miễn phí</strong> khi <strong>lỗi do nhà<br>sản xuất</strong>. (Hư gì đổi nấy)</p>
        <p><strong>Hoàn tiền</strong> phí <strong>20%</strong> (hàng lỗi<br>hoặc không lỗi).</p>
      </td>
      <td>
        <p>- Nhận <strong>bảo hành có cam kết thời gian</strong>(*)</p>
        <p>- Nếu chọn đổi mới “hư gì đổi nấy”: trả phí <strong>10%</strong><br>giá trị sản phẩm cho <strong>tháng thứ 2</strong> và cộng thêm<br><strong>10%</strong> giá trị sản phẩm cho mỗi tháng tiếp theo</p>
        <p>- Nếu chọn hoàn tiền : trừ phí <strong>30%</strong> giá trị hóa đơn<br>cho <strong>tháng thứ 2</strong> và cộng thêm <strong>10%</strong> giá trị sản<br>phẩm cho mỗi tháng tiếp theo</p>
      </td>
      <td>
        <p>(*)Lỗi đổi mới hư gì đổi nấy áp dụng:</p>
        <p>- <strong>Lỗi kỹ thuật do nhà sản xuất</strong></p>
        <p>- Lỗi sản phẩm chính đổi sản phẩm chính</p>
        <p>- Lỗi phụ kiện đi kèm đổi sản phẩm có công dụng<br>tương đương hoặc nhận <strong>bảo hành có cam kết<br>thời gian</strong></p>
        <p>- Nếu chọn đổi nguyên hộp mới trả phí <strong>20%</strong> giá<br>trị sản phẩm</p>
      </td>
    </tr>
    <tr>
      <th scope="row">
        <p>PHỤ KIỆN TIỆN ÍCH</p>
        <p>(TRỪ HÃNG<br>HYDRUS BAO XÀI 7<br>NGÀY)</p>
      </th>
      <td colspan="2">
        <p>- Nhận <strong>bảo hành có cam kết thời gian</strong></p>
        <p>- Nếu chọn hoàn tiền tháng đầu tiên trả phí <strong>20%</strong> giá trị sản phẩm và cộng thêm <strong>10%</strong><br>giá trị sản phẩm cho mỗi tháng tiếp theo</p>
        <p>- <strong>PHỤ KIỆN GIÁ RẺ</strong>:  <strong>Không bảo hành.</strong> Chỉ đổi trả trong vòng <strong>7 ngày</strong> nếu sản<br>phẩm lỗi kỹ thuật. Sản phẩm chỉ cho trả nếu Lỗi kỹ thuật, Không cho trả Đã sử dụng</p>
      </td>
      <td>
        <p><strong>Phụ kiện Apple và Beats</strong> áp dụng chính sách<br>riêng theo mã hàng.</p>
        <p>- Một số sản phẩm bảo hành tại chỗ ngay và luôn.</p>
      </td>
    </tr>
    <tr>
      <th scope="row">
        <p>ĐỒNG HỒ<br>(THỜI TRANG VÀ<br>SMARTWATCH)</p>
      </th>
      <td>
        <p><strong>Smartwatch</strong> Bảo hành cam kết (*)<br>hoặc hoàn tiền trả phí <strong>20%</strong> hoá<br>đơn</p>
        <p><strong>Thời trang</strong> Bảo hành cam kết</p>
      </td>
      <td class="returns-watch">
        <p><strong>Smartwatch</strong> Bảo hành cam kết (*) hoặc hoàn<br>tiền trả phí <strong>30%</strong>, mỗi tháng +<strong>10%</strong></p>
        <p><strong>Thời trang</strong> Bảo hành hoặc đổi lỗi theo hãng.<br><strong>Không áp dụng hoàn tiền</strong>.</p>
      </td>
      <td>
        <p><strong>ÁP DỤNG LỖI KỸ THUẬT DO NHÀ SẢN<br>XUẤT</strong></p>
        <p><strong>Thời trang</strong> ELIO, EYKI, SKMEI và SMILE<br>KID <strong>đổi 1 lấy 1 miễn phí</strong> trong <strong>6 tháng</strong> khi lỗi<br>do hãng. Hãng khác bảo hành cam kết <strong>12 tháng</strong>.</p>
      </td>
    </tr>
    <tr>
      <th scope="row">
        <p>HÀNG ĐÃ SỬ<br>DỤNG / HÀNG<br>TRƯNG BÀY</p>
      </th>
      <td>
        <p>Sản Phẩm lỗi kĩ thuật <strong>7 Ngày đầu<br>tiên</strong> :</p>
        <p>1. <strong>Hoàn tiền 100%</strong> nếu sản phẩm<br>lỗi NSX (Trừ ĐIỆN THOẠI,<br>LAPTOP, TABLE,<br>SMARTWATCH áp dụng “2”)</p>
        <p>2. <strong>Từ ngày thứ 8 đến ngày thứ 30</strong><br>: Phí trả hàng <strong>10%</strong> giá trị hóa đơn<br>cho sản phẩm lỗi (Sản phẩm không<br>lỗi không áp dụng)</p>
      </td>
      <td>
        <p><strong>Từ Ngày thứ 31 trở đi</strong> :</p>
        <p>- <strong>Không áp dụng đổi trả</strong>.</p>
        <p>- Áp dụng bảo hành hãng nếu sản phẩm còn thời<br>gian bảo hành của hãng và đủ điều kiện bảo hành<br>của hãng</p>
      </td>
      <td>
        <p>- Sản phẩm lỗi NSX <strong>có thông tin xác nhận từ<br>Hãng</strong></p>
        <p>- Sản phẩm đổi trả phải giữ nguyên <strong>100%</strong> hình<br>dạng ban đầu và đủ điều kiện bảo hành của hãng.</p>
        <p>- Sản phẩm chỉ dùng cho mục đích sử dụng cá<br>nhân, không áp dụng việc sử dụng sản phẩm cho<br>mục đích thương mại.</p>
        <p>- Hoàn trả lại đầy đủ sạc, phụ kiện đi kèm: mất<br>phụ kiện thu phí theo giá bán tối thiểu trên<br>website TGDĐ/ĐMX và chính hãng (tối đa <strong>5%</strong><br>giá trị hóa đơn).</p>
      </td>
    </tr>
    </tbody>
    <tfoot>
    <tr>
      <td colspan="4">
        <p><strong>(*) Bảo hành cam kết 12 tháng</strong> cho sản phẩm chính đủ điều kiện bảo hành hãng. Siêu thị báo khách nhận máy trong <strong>15 ngày</strong> từ lúc tiếp nhận máy lỗi. Nếu quá<br>hạn hoặc phải bảo hành lại trong <strong>30 ngày</strong> từ khi xử lý xong, giảm <strong>50%</strong> phí đổi hoặc phí hoàn tiền tùy nhóm. Từ <strong>tháng 13</strong>, bảo hành hãng nếu còn hạn.</p>
        <p><strong>Khi đổi trả,</strong> giữ sản phẩm nguyên vẹn và hoàn đủ phụ kiện, quà tặng theo quy định. Hàng cũ/trưng bày thiếu phụ kiện chịu phí tối đa <strong>5%</strong>. Điện gia dụng, gia<br>dụng lắp đặt, phụ kiện tiện ích và đồng hồ cần <strong>xác thực OTP</strong>.</p>
        <p><strong>Phí tính trên giá trị hóa đơn</strong>. Các mốc thời gian tính từ ngày mua.</p>
        <p>Chi tiết và chính sách theo từng mã hàng tại <a href="https://www.dienmayxanh.com/chinh-sach-bao-hanh-san-pham">dienmayxanh.com/chinh-sach-bao-hanh-san-pham</a>  |  Bảo hành <strong>1900 232 465</strong></p>
      </td>
    </tr>
    </tfoot>
  </table>
</article>
`,
 css:`
@font-face{font-family:"Returns Serif";src:url("/assets/ncn-store-tools/sales/returns-serif-regular.woff2") format("woff2");font-weight:400}
@font-face{font-family:"Returns Serif";src:url("/assets/ncn-store-tools/sales/returns-serif-bold.woff2") format("woff2");font-weight:700}
.returns-slip{width:100%;background:#fff;color:#000;font:8.5pt/9.25pt "Returns Serif","Times New Roman",serif}
.returns-header{position:relative;display:flex;align-items:center;justify-content:center;height:6.65mm}
.returns-header img{position:absolute;left:0;width:36mm;height:auto}
.returns-header h1{margin:0;font-size:14pt;line-height:1.15;text-align:center}
.returns-table{width:100%;border-collapse:collapse;table-layout:fixed}
.returns-table col:nth-child(1){width:17.86%}
.returns-table col:nth-child(2){width:21.69%}
.returns-table col:nth-child(3){width:30.62%}
.returns-table th,.returns-table td{border:.5pt solid #000;padding:.38mm 1.06mm;vertical-align:middle}
.returns-table th{font-size:9.5pt;line-height:10.8pt;text-align:left}
.returns-table thead th{text-align:center}
/* Keep the Word line breaks and character width when printing at either size. */
.returns-table p{margin:0;white-space:pre}
.returns-table td p{transform:scaleX(.90);transform-origin:left center}
.returns-table tfoot,.returns-watch{font-size:9pt;line-height:10.15pt}
.returns-table a{color:inherit;text-decoration:underline}
`
};

const assets=[
 {path:'/assets/ncn-store-tools/sales/returns-serif-regular.woff2',mime:'font/woff2',sha256:'5418a7ab0104f14f5e451b8ed1e8d74eece5a3e830c29b951aeeaf7002220902',bytes:15600},
 {path:'/assets/ncn-store-tools/sales/returns-serif-bold.woff2',mime:'font/woff2',sha256:'81da761bc06c8167ef855ffee029493e8f7309513c60915fffcdb55c9e1652d4',bytes:14668}
];

export function withReturnsTemplate(catalogue){
 return {...catalogue,models:[model,...catalogue.models],layouts:[layout,...catalogue.layouts],assets:[...assets,...catalogue.assets]};
}
