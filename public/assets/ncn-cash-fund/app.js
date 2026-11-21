import { ensureSession, onAuthChange } from '../ncn-identity-client.js';
import { CASH_FUND_TYPES, NOTE_MAX_LENGTH, vietnamDate } from './shared.js';
import { erpInputText } from '../ncn-cash/core.js';

const endpoint = '/.netlify/functions/ncn-cash-fund';
const formatter = new Intl.NumberFormat('vi-VN');
const clock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false
});
const connectionError = 'Chưa kết nối được sổ quỹ. Vui lòng thử lại.';
const loginMessage = 'Đăng nhập tài khoản có quyền quỹ để xem số dư và lập phiếu.';
const money = amount => formatter.format(amount) + '\u00a0₫';
const displayDate = date => date.split('-').reverse().join('/');

function readAmount(value) {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:[.,\s]\d{3})+)$/.test(text)) return null;
  const amount = Number(text.replace(/[.,\s]/g, ''));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function mount() {
  const root = document.getElementById('ncn-cash-fund-app');
  if (!root) return;
  const $ = id => root.querySelector('#cf-' + id);
  const ledger = $('ledger');
  const access = $('access');
  const history = $('history');
  const entries = $('entries');
  const filters = $('filters');
  const more = $('more');
  const dialog = $('receipt');
  const form = $('receipt-form');
  const fields = form.elements;
  fields.note.maxLength = NOTE_MAX_LENGTH;
  const receiptButtons = [...root.querySelectorAll('[data-cf-receipt]')];
  let active = null;
  let saving = false;
  let pending = null;
  const amountInput = fields.amount;
  const amountCharacters = /^[0-9., \u00a0\u202f]*$/;
  let acceptedAmount;

  function rememberAmount() {
    acceptedAmount = {
      value: amountInput.value, start: amountInput.selectionStart, end: amountInput.selectionEnd
    };
  }

  function formatAmountInput(event) {
    const raw = amountInput.value;
    try {
      if (!amountCharacters.test(raw)) throw new Error('Invalid amount characters');
      const editing = event.inputType?.startsWith('delete') ||
        event.inputType === 'insertText' && /^\d+$/.test(event.data ?? '');
      const formatted = erpInputText(editing ? raw.replaceAll(',', '') : raw);
      const caret = amountInput.selectionStart ?? raw.length;
      const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length;
      amountInput.value = formatted;
      let position = 0, digits = 0;
      while (position < formatted.length && digits < digitsBeforeCaret) {
        if (/\d/.test(formatted[position])) digits++;
        position++;
      }
      if (event.inputType === 'deleteContentForward' && formatted[position] === ',') position++;
      amountInput.setSelectionRange(position, position);
      rememberAmount();
    } catch {
      amountInput.value = acceptedAmount.value;
      amountInput.setSelectionRange(acceptedAmount.start, acceptedAmount.end);
    }
  }

  rememberAmount();

  function message(id, text, error = false) {
    const node = $(id);
    node.textContent = text;
    node.hidden = !text;
    node.toggleAttribute('data-error', error);
  }

  function setSaving(value) {
    saving = value;
    $('fields').disabled = $('save').disabled = $('cancel').disabled = value;
  }

  function lock(text, action = '') {
    active?.controller.abort();
    active = null;
    setSaving(false);
    if (dialog.open) dialog.close();
    pending = null;
    form.reset();
    rememberAmount();
    filters.reset();
    entries.replaceChildren();
    $('balance').textContent = '';
    history.hidden = more.hidden = ledger.hidden = true;
    access.hidden = !text;
    message('access-message', text);
    $('login').hidden = action !== 'login';
    $('retry').hidden = action !== 'retry';
  }

  function setHistoryLoading(value) {
    filters.querySelector('button').disabled = more.disabled = value;
    for (const button of receiptButtons) button.disabled = value;
  }

  async function request(scope, { query, receipt } = {}) {
    const url = new URL(endpoint, location.origin);
    if (query) url.search = query.toString();
    const response = await fetch(url, {
      credentials: 'same-origin', cache: 'no-store',
      signal: AbortSignal.any([scope.controller.signal, AbortSignal.timeout(18000)]),
      ...(receipt ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receipt)
      } : {})
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      throw Object.assign(new Error(data?.error || connectionError), { status: response.status });
    }
    return data;
  }

  function row(entry) {
    const tr = document.createElement('tr');
    const cells = [
      ['type', CASH_FUND_TYPES[entry.type] || '', 'cf-entry-' + entry.type],
      ['amount', (entry.type === 'in' ? '+ ' : '− ') + money(entry.amount)],
      ['balance', money(entry.balanceBefore) + ' → ' + money(entry.balanceAfter)],
      ['note', entry.note],
      ['time', displayDate(entry.date)]
    ];
    for (const [name, value, color] of cells) {
      const td = tr.insertCell();
      td.className = 'cf-entry-' + name + (color ? ' ' + color : '');
      td.textContent = value;
    }
    const recorded = document.createElement('small');
    recorded.textContent = clock.format(new Date(entry.recordedAt)) + ' · ' + entry.actor;
    tr.lastElementChild.append(recorded);
    return tr;
  }

  function handleAccessError(error) {
    if (error.status === 401) {
      lock(loginMessage, 'login');
      return true;
    }
    if (error.status === 403) {
      lock(error.message);
      return true;
    }
    return false;
  }

  async function loadHistory(scope, append = false, saved = false) {
    if (scope.loading) return;
    scope.loading = true;
    setHistoryLoading(true);
    const query = append ? new URLSearchParams(scope.filters) : new URLSearchParams(new FormData(filters));
    if (append) query.set('after', scope.next);
    try {
      const result = await request(scope, { query });
      if (active !== scope) return;
      const rows = result.entries.map(row);
      $('balance').textContent = money(result.balance);
      if (append) entries.append(...rows);
      else entries.replaceChildren(...rows);
      history.hidden = !entries.childElementCount;
      more.hidden = !result.next;
      scope.next = result.next;
      scope.authorized = true;
      if (!append) scope.filters = query;
      access.hidden = true;
      ledger.hidden = false;
      const empty = query.get('from') || query.get('to') || query.get('type')
        ? 'Chưa có phiếu phù hợp với bộ lọc.' : 'Chưa có phiếu thu chi.';
      message('history-message', saved ? 'Đã lưu phiếu.' : history.hidden ? empty : '');
    } catch (error) {
      if (active !== scope || handleAccessError(error)) return;
      const text = error.status ? error.message : connectionError;
      if (scope.authorized) {
        message('history-message', saved ? 'Đã lưu phiếu. Bấm Tìm để cập nhật số dư và lịch sử.' : text, !saved);
      } else {
        lock(text, 'retry');
      }
    } finally {
      if (active === scope) {
        scope.loading = false;
        setHistoryLoading(false);
      }
    }
  }

  async function start() {
    lock('Đang kiểm tra quyền xem sổ quỹ…');
    const scope = { controller: new AbortController(), authorized: false };
    active = scope;
    try {
      const session = await ensureSession();
      if (active !== scope) return;
      if (!session?.id) {
        lock(loginMessage, 'login');
        return;
      }
      scope.owner = session.id;
      await loadHistory(scope);
    } catch {
      if (active === scope) lock(connectionError, 'retry');
    }
  }

  function openReceipt(button) {
    if (!active?.authorized || active.loading) return;
    pending = null;
    form.reset();
    rememberAmount();
    fields.type.value = button.dataset.cfReceipt;
    fields.date.max = fields.date.value = vietnamDate();
    message('receipt-message', '');
    dialog.showModal();
  }

  for (const button of receiptButtons) button.addEventListener('click', () => openReceipt(button));
  $('retry').addEventListener('click', start);
  $('cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
  filters.addEventListener('submit', event => {
    event.preventDefault();
    if (active?.authorized) loadHistory(active);
  });
  more.addEventListener('click', () => {
    if (active?.authorized && active.next) loadHistory(active, true);
  });
  amountInput.addEventListener('beforeinput', event => {
    rememberAmount();
    if (event.data != null && !amountCharacters.test(event.data)) event.preventDefault();
  });
  for (const type of ['paste', 'drop']) amountInput.addEventListener(type, event => {
    const text = (event.clipboardData || event.dataTransfer)?.getData('text/plain');
    if (text == null) return;
    try {
      if (!amountCharacters.test(text)) throw new Error('Invalid amount characters');
      erpInputText(text);
      if (type === 'paste') {
        event.preventDefault();
        rememberAmount();
        const digits = text.replace(/\D/g, '');
        amountInput.setRangeText(digits, amountInput.selectionStart, amountInput.selectionEnd, 'end');
        formatAmountInput({ inputType: 'insertText', data: digits });
      }
    } catch {
      event.preventDefault();
    }
  });
  amountInput.addEventListener('input', formatAmountInput);
  amountInput.addEventListener('change', formatAmountInput);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const scope = active;
    if (!scope?.authorized || saving) return;
    const amount = readAmount(fields.amount.value);
    const note = fields.note.value.trim();
    if (amount === null || !note) {
      message('receipt-message', amount === null ? 'Nhập số tiền nguyên lớn hơn 0.' : 'Nhập nội dung phiếu.', true);
      (amount === null ? fields.amount : fields.note).focus();
      return;
    }
    const receipt = { owner: scope.owner, type: fields.type.value, date: fields.date.value, amount, note };
    const signature = JSON.stringify(receipt);
    if (pending?.signature !== signature) pending = { signature, id: crypto.randomUUID() };
    setSaving(true);
    message('receipt-message', 'Đang lưu phiếu…');
    try {
      await request(scope, { receipt: { ...receipt, id: pending.id } });
      if (active !== scope) return;
      pending = null;
      dialog.close();
      await loadHistory(scope, false, true);
    } catch (error) {
      if (active !== scope || handleAccessError(error)) return;
      const text = error.status ? error.message : 'Chưa nhận được xác nhận. Bấm Lưu phiếu để thử lại.';
      message('receipt-message', text, true);
    } finally {
      if (active === scope) setSaving(false);
    }
  });

  document.addEventListener('ncn-account-change', event => {
    if (active?.authorized && !event.detail.user) lock(loginMessage, 'login');
  });
  onAuthChange((event, user) => {
    if (event === 'logout') lock(loginMessage, 'login');
    else if (event === 'login' || (user?.id && user.id !== active?.owner)) start();
  });
  window.addEventListener('pagehide', () => lock(''));
  window.addEventListener('pageshow', event => { if (event.persisted) start(); });
  start();
}

mount();
