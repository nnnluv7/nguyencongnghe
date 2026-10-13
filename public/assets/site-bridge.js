/* Chuyengia.vip: local navigation, search and compatibility fixes. */
(() => {
  'use strict';
  const posts = window.CG_CATALOG || [];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const config = window.CG_CONFIG || {};

  function selectPosts(url) {
    const parsed = new URL(url, location.origin);
    const label = parsed.pathname.match(/^\/search\/label\/(.+?)\/?$/);
    let selected = posts.filter(p => !p.isPage);
    if (label) selected = selected.filter(p => p.labels.includes(decodeURIComponent(label[1])));
    const query = parsed.searchParams.get('q');
    if (query && query !== '|') {
      const needle = fold(query);
      selected = posts.filter(p => fold(`${p.title} ${p.summary} ${p.labels.join(' ')}`).includes(needle));
    }
    const updatedMax = parsed.searchParams.get('updated-max');
    if (updatedMax) selected = selected.filter(p => new Date(p.datetime) < new Date(updatedMax));
    const start = Math.max(0, Number(parsed.searchParams.get('start-index') || 1) - 1);
    const count = Math.min(500, Math.max(1, Number(parsed.searchParams.get('max-results') || 10)));
    return {items:selected.slice(start, start + count), more:selected.length > start + count, next:start + count + 1, count, parsed};
  }

  function cards(items) {
    return items.map((p, i) => `<article class="hentry post-filter item${i}"><a class="post-filter-inner image-nos" href="${escape(p.link)}"><span class="post-filter-link"><img class="snip-thumbnail lazy-img" src="${escape(p.thumbnail.src)}" data-src="${escape(p.thumbnail.src)}" alt="${escape(p.title)}" loading="lazy"></span></a><div class="entery-category-box"><span class="post-tag">${escape(p.category)}</span><h2 class="entry-title vcard"><a href="${escape(p.link)}">${escape(p.title)}</a></h2><p class="post-snippet">${escape(p.summary)}</p><div class="post-snip">Tác giả - <span class="post-author">${escape(p.author)}</span> <span class="post-date published" datetime="${escape(p.datetime)}">${escape(p.date)}</span></div><a class="read-more" href="${escape(p.link)}">Xem chi tiết!</a></div></article>`).join('');
  }

  function responseHTML(url) {
    const result = selectPosts(url);
    const nextURL = new URL(result.parsed);
    nextURL.searchParams.set('start-index', String(result.next));
    nextURL.searchParams.set('max-results', String(result.count));
    const next = result.more ? `<a id="load-more-link" data-load="${escape(nextURL.pathname + nextURL.search)}"></a>` : '';
    return `<html><body><div class="cg-native-response"><script id="native-feed" type="application/json">${JSON.stringify({feed:{entry:result.items}}).replace(/</g, '\\u003c')}<\/script><div class="grid-posts">${cards(result.items)}</div>${next}</div></body></html>`;
  }

  // The Blogger theme requests search HTML for its cards, sidebar and live search.
  // Return the same document contract from the saved catalog instead of Blogger.
  const $ = window.jQuery;
  if ($) {
    const originalAjax = $.ajax.bind($);
    $.ajax = function (first, second) {
      const options = typeof first === 'string' ? {...second, url:first} : {...first};
      const requested = new URL(options.url || location.href, location.origin);
      const internal = requested.origin === location.origin || requested.origin === config.originalOrigin;
      if (!internal || !requested.pathname.startsWith('/search')) return originalAjax(first, second);
      const deferred = $.Deferred();
      let stopped = false;
      const request = deferred.promise({status:200, statusText:'OK', abort(){ stopped = true; deferred.reject(this, 'abort'); return this; }});
      if (options.beforeSend?.(request, options) === false) return request.abort();
      queueMicrotask(() => {
        if (stopped) return;
        try {
          const html = responseHTML(requested.href);
          options.success?.(html, 'success', request);
          deferred.resolve(html, 'success', request);
          options.complete?.(request, 'success');
        } catch (error) {
          request.status = 500;
          options.error?.(request, 'error', error);
          deferred.reject(request, 'error', error);
          options.complete?.(request, 'error');
        }
      });
      return request;
    };
  }

  function toast(message) {
    let element = document.getElementById('cg-toast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'cg-toast';
      element.setAttribute('role', 'status');
      document.body.append(element);
    }
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(element.hideTimer);
    element.hideTimer = setTimeout(() => element.classList.remove('visible'), 3500);
  }

  async function sharePage(event) {
    event.preventDefault();
    const data = {title:document.title, url:location.href};
    try {
      if (navigator.share) await navigator.share(data);
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(data.url); toast('Đã sao chép đường dẫn.'); }
      else window.prompt('Sao chép đường dẫn trang này:', data.url);
    } catch (error) { if (error.name !== 'AbortError') window.prompt('Sao chép đường dẫn trang này:', data.url); }
  }

  function commentForm(container) {
    const storageKey = `cg-comments:${location.pathname}`;
    let comments = [];
    try { comments = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { /* Ignore a damaged local draft. */ }
    container.innerHTML = `<div class="widget-title comments-title"><h3>Bình luận</h3></div><p class="cg-local-note">Các bình luận ở đây được lưu trên thiết bị của bạn.</p><div class="cg-comment-list"></div><form class="cg-comment-form"><label>Họ tên<input name="name" autocomplete="name" required maxlength="80"></label><label>Nội dung<textarea name="message" required maxlength="2000" rows="4"></textarea></label><button class="qz-btn" type="submit">Đăng bình luận</button></form>`;
    const render = () => {
      container.querySelector('.cg-comment-list').innerHTML = comments.map(c => `<div class="cg-comment"><b>${escape(c.name)}</b><small>${escape(new Date(c.time).toLocaleString('vi-VN'))}</small><p>${escape(c.message)}</p></div>`).join('');
    };
    render();
    container.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const name = form.elements.name.value.trim(), message = form.elements.message.value.trim();
      if (!name || !message) return;
      const next = [...comments, {name, message, time:new Date().toISOString()}];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); comments = next; render(); form.elements.message.value = ''; toast('Đã lưu bình luận trên thiết bị.'); }
      catch { toast('Thiết bị không cho phép lưu bình luận.'); }
    });
  }

  function ready() {
    if (window.CG_ROUTE === 'search') {
      const result = selectPosts(location.href);
      const grid = document.querySelector('.grid-posts');
      if (grid) grid.innerHTML = result.items.length ? cards(result.items) : '<p class="error-status">Không tìm thấy kết quả nào.</p>';
      const title = document.querySelector('.blog-posts > .widget-title h3');
      if (title) title.textContent = result.parsed.searchParams.get('q') ? `Kết quả: ${result.parsed.searchParams.get('q')}` : (document.body.dataset.label || 'Tất cả bài viết');
      const more = document.getElementById('load-more-link');
      if (more) {
        const next = new URL(result.parsed);
        next.searchParams.set('start-index', String(result.next));
        next.searchParams.set('max-results', String(result.count));
        more.dataset.load = result.more ? next.pathname + next.search : '';
        if (!result.more) more.remove();
      }
    }

    document.querySelectorAll('.share-it').forEach(button => button.addEventListener('click', sharePage));
    document.querySelectorAll('.window-t[data-url]').forEach(button => {
      const target=button.getAttribute('data-url').replaceAll(config.originalOrigin+location.pathname,location.href);
      button.setAttribute('data-url',target);
    });
    document.querySelectorAll('.auth-field').forEach(field => { const input=field.querySelector('input'), label=field.querySelector('label'); if (input && label) label.htmlFor=input.id; });
    document.querySelectorAll('.auth-modal').forEach(modal => {
      modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
      modal.addEventListener('click', event => { if (event.target === modal) window.closeAuth?.(); });
    });
    document.querySelectorAll('.comments-section').forEach(commentForm);
    document.querySelectorAll('.js-hdin, .js-changetit').forEach(a => a.addEventListener('click', event => event.preventDefault()));
    document.querySelectorAll('.modal_tits').forEach((element, index) => { element.setAttribute('role','button'); element.tabIndex=0; element.setAttribute('aria-label',`Chọn mẫu tiêu đề ${index+1}`); element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();element.click();}}); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        window.closeAuth?.();
        document.querySelectorAll('.modal-open').forEach(e=>e.classList.remove('modal-open'));
        document.body.classList.remove('spring-open','active-search');
        $('#search-flex').hide();
      }
    });
    document.querySelectorAll('.auth-input').forEach(input=> input.addEventListener('keydown',event=>{ if(event.key==='Enter'){ const modal=input.closest('.auth-modal'); modal?.querySelector('.auth-submit')?.click(); } }));
    const search = document.querySelector('.search-form .search-input');
    search?.addEventListener('keydown', event => { if(event.key==='Enter' && search.value.trim()) location.href='/search?q='+encodeURIComponent(search.value.trim()); });

    window.switchModal = id => { window.openModal(id); setTimeout(()=>document.querySelector(`#modal-${id} input`)?.focus(),0); };
    window.doForgot = () => {
      const email = document.getElementById('forgot-email'), message = document.getElementById('forgot-msg');
      message.style.display='block';
      if (!email.value.trim() || !email.checkValidity()) { message.textContent='Anh/chị nhập email hợp lệ nhé.'; return; }
      message.innerHTML=`Vui lòng <a href="/p/contact-us.html">liên hệ quản trị viên</a> để khôi phục tài khoản theo email đã đăng ký.`;
    };
    window.CG = {selectPosts, cards, toast};
  }
  if ($) $(ready); else document.addEventListener('DOMContentLoaded', ready);
})();
