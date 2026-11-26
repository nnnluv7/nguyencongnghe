import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseGenkRSS,syncGenkNews,readGenkArticle} from '../netlify/lib/ncn-news.mjs';
import {genkSummaryHTML} from '../netlify/lib/ncn-community-render.mjs';
import {memoryStories} from './fixtures/ncn-stories.mjs';

const now=Date.parse('2026-11-26T04:00:00Z'),href='https://genk.vn/tin-thu-nghiem.chn';
const description='Thiết bị mới có màn hình 6,7 inch và pin 5.000 mAh. '+('Thông tin thử nghiệm bổ sung cho phần đọc chi tiết. ').repeat(40)+'Giá và thời điểm bán sẽ được công bố sau.';
const rss='<rss><channel><item><title>Tin thử nghiệm</title><link>'+href+'</link><description><![CDATA[<img src="https://genk.mediacdn.vn/test.jpg">'+description+']]></description><pubDate>Thu, 26 Nov 2026 10:00:00 +0700</pubDate></item></channel></rss>';

test('the reader keeps the complete RSS description, including text beyond 1500 characters',()=>{
  const [item]=parseGenkRSS(rss,now);assert.equal(item.summaryLong,description);assert.equal(item.summary.length,180);assert.equal(item.summaryVersion,2);
  const html=genkSummaryHTML(item);assert.ok(html.includes(description));assert.equal(html.includes('<img '),false);
  assert.ok(html.includes(href));assert.ok(html.includes('Đọc toàn bộ bài trên GenK'));
});
test('the first sync refreshes a cached short feed and archive without changing the article ID',async()=>{
  const store=memoryStories(),id='rss-genk-'+createHash('sha256').update(href).digest('hex').slice(0,20),short={id,source:'GenK',link:href,title:'Tin thử nghiệm',summary:description.slice(0,180)};
  await store.setJSON('genk',{items:[short],etag:'old-feed',lastModified:'yesterday',metadataArchived:true});await store.setJSON('article-'+id,short);
  await syncGenkNews(store,{now,fetcher:async(_url,options)=>{
    assert.equal(options.headers['If-None-Match'],undefined);assert.equal(options.headers['If-Modified-Since'],undefined);
    return new Response(rss,{headers:{'Content-Type':'text/xml','ETag':'new-feed'}});
  }});
  assert.equal((await store.get('genk')).items[0].summaryLong,description);assert.equal((await store.get('article-'+id)).summaryLong,description);
  const before=structuredClone([...store.entries]);
  await syncGenkNews(store,{now,fetcher:async(_url,options)=>{assert.equal(options.headers['If-None-Match'],'new-feed');return new Response(null,{status:304});}});
  assert.deepEqual([...store.entries],before);
  await store.setJSON('genk',{items:[]});assert.equal((await readGenkArticle(store,id)).summaryLong,description);
});
test('RSS reader escapes feed text and retains older cached descriptions as a fallback',()=>{
  const html=genkSummaryHTML({link:href,summary:'Đoạn xem trước',summaryLong:'<script>alert(1)</script> & nội dung đầy đủ'});
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; nội dung đầy đủ'));assert.equal(html.includes('<script>'),false);
  assert.ok(genkSummaryHTML({link:href,summary:'Mô tả lưu trước cập nhật'}).includes('Mô tả lưu trước cập nhật'));
  assert.ok(genkSummaryHTML({link:href}).includes('Mở bài gốc để đọc đầy đủ nội dung.'));
});
