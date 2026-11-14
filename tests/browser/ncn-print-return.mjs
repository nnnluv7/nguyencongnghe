import assert from 'node:assert/strict';

export const iPhoneUserAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const safariUserAgent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';

// Replace only the native print dialog in these fixtures. Exercise the actual
// editor, embedded assets, print document and return-event handlers.
export function instrumentPrintFrames(){
  if(window!==window.top)return;
  window.__ncnPrints=[];window.__ncnPrintFocus=0;
  window.__ncnEndPrint=({selector,event})=>{
    document.querySelector(selector).contentDocument.body.replaceChildren();
    if(event==='afterprint')window.__ncnPrintFrame.contentWindow.dispatchEvent(new Event('afterprint'));
    else if(event==='focus')window.dispatchEvent(new FocusEvent('focus'));
    else{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;
    }
  };
  const create=Document.prototype.createElement;
  Document.prototype.createElement=function(...args){
    const node=create.apply(this,args);
    if(String(args[0]).toLowerCase()==='iframe')node.addEventListener('load',()=>{
      if(!node.hasAttribute('data-ncn-print-job'))return;
      node.contentWindow.focus=()=>{window.__ncnPrintFocus++;};
      node.contentWindow.print=()=>{
        window.__ncnPrintFrame=node;
        window.__ncnPrints.push({text:node.contentDocument.body.textContent+' '+[...node.contentDocument.querySelectorAll('input')].map(input=>input.value).join(' '),
          fonts:node.contentDocument.fonts.status,
          images:[...node.contentDocument.images].every(image=>image.complete&&image.naturalWidth>0)});
        if(window.__ncnPrintReturn)window.__ncnEndPrint(window.__ncnPrintReturn);
      };
    });
    return node;
  };
}

export async function verifyPrintReturns({browser,base,out}){
  const cases=[
    ['/sticker/?mau=gg2&co=1','st',0,'SẢN PHẨM THỬ IN'],
    ['/popup-a7/?mau=btn-gach','st',0,'SẢN PHẨM THỬ IN'],
    ['/ban-hang/?mau=sales-bh-giao-hang','nt',2,'KHÁCH HÀNG THỬ IN'],
    ['/ban-hang/?mau=sales-doi-tra-bao-hanh','nt',null,'CHÍNH SÁCH ĐỔI TRẢ'],
    ['/trang-tri/?mau=decor-buom-2','nt',null,null]
  ];
  for(const profile of [{name:'desktop',ios:false,asynchronous:false},{name:'iphone',ios:true,asynchronous:true,userAgent:iPhoneUserAgent},{name:'safari',ios:false,asynchronous:true,userAgent:safariUserAgent}])for(const [path,prefix,index,value]of cases){
    const {ios,asynchronous}=profile;
    const page=await browser.newPage({viewport:{width:ios?390:1280,height:900},isMobile:ios,hasTouch:ios,...(profile.userAgent?{userAgent:profile.userAgent}:{})}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(instrumentPrintFrames);
    await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    try{
      await page.goto(base+path,{waitUntil:'domcontentloaded'});
      const preview=page.frameLocator('#'+prefix+'-preview');
      await preview.locator('.ncn-sheet').first().waitFor({state:'attached'});
      await page.waitForFunction(prefix=>document.getElementById(prefix+'-preview').contentDocument.readyState==='complete',prefix);
      if(index!==null)await preview.locator('[data-ncn-copy="0"][data-field="'+index+'"]').fill(value);
      await page.locator('.ncn-direct-controls').getByRole('button',{name:'Phóng to',exact:true}).click();
      const scale=await page.locator('#'+prefix+'-preview').evaluate(frame=>frame.style.transform);
      for(const event of ['afterprint','focus','visibility']){
        const previous=await page.evaluate(()=>window.__ncnPrints.length);
        if(!asynchronous)await page.evaluate(config=>{window.__ncnPrintReturn=config;},{selector:'#'+prefix+'-preview',event});
        await page.getByRole('button',{name:'In ngay',exact:true}).click();
        await page.waitForFunction(count=>window.__ncnPrints.length===count+1,previous);
        const printed=await page.evaluate(()=>window.__ncnPrints.at(-1));
        if(value)assert.ok(printed.text.includes(value),path+': entered text reaches the passive print document');
        assert.equal(printed.fonts,'loaded');assert.equal(printed.images,true);
        // Simulate a lost preview surface on return from the system print view.
        if(asynchronous){
          assert.equal(await page.locator('iframe[data-ncn-print-job]').count(),1);
          await page.evaluate(config=>window.__ncnEndPrint(config),{selector:'#'+prefix+'-preview',event});
          if(event==='afterprint'){
            assert.equal(await page.locator('iframe[data-ncn-print-job]').count(),1,'an early Safari afterprint must not destroy the source while its dialog is open');
            await page.evaluate(()=>window.dispatchEvent(new FocusEvent('focus')));
          }
        }
        await page.locator('iframe[data-ncn-print-job]').waitFor({state:'detached'});
        await preview.locator('.ncn-sheet').first().waitFor({state:'attached'});
        if(index!==null)await page.waitForFunction(({prefix,index,value})=>document.getElementById(prefix+'-preview').contentDocument.querySelector('[data-ncn-copy="0"][data-field="'+index+'"]')?.value===value,{prefix,index,value});
        if(index!==null)assert.equal(await preview.locator('[data-ncn-copy="0"][data-field="'+index+'"]').inputValue(),value);
        assert.equal(await page.locator('#'+prefix+'-preview').evaluate(frame=>frame.style.transform),scale,'zoom survives returning from print');
      }
      // Safari can also restore this page from its back/forward cache.
      await page.evaluate(prefix=>{
        document.getElementById(prefix+'-preview').contentDocument.body.replaceChildren();
        window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
      },prefix);
      await preview.locator('.ncn-sheet').first().waitFor({state:'attached'});
      if(index!==null)await page.waitForFunction(({prefix,index,value})=>document.getElementById(prefix+'-preview').contentDocument.querySelector('[data-ncn-copy="0"][data-field="'+index+'"]')?.value===value,{prefix,index,value});
      if(index!==null)assert.equal(await preview.locator('[data-ncn-copy="0"][data-field="'+index+'"]').inputValue(),value);
      assert.equal(await page.evaluate(()=>window.__ncnPrintFocus),0,'off-screen print frames never take focus');
      assert.deepEqual(errors,[]);
      await page.screenshot({path:out+'/return-'+prefix+'-'+cases.findIndex(item=>item[0]===path)+'-'+profile.name+'.jpg',type:'jpeg',quality:75});
      console.log('PASS print returns '+path+' ('+profile.name+'): repeated cancel, early afterprint, focus, visibility, BFCache, state and zoom');
    }finally{await page.close();}
  }
}
