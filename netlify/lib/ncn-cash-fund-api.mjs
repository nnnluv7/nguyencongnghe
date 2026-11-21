import { createHash } from 'node:crypto';
import { CASH_FUND_TYPES, NOTE_MAX_LENGTH, vietnamDate } from '../../public/assets/ncn-cash-fund/shared.js';

// The old shared `ledger` stays untouched. A verified account ID alone selects
// the personal ledger; request fields, roles and email can never select another.
const ledgerKey = userId => 'personal/' + createHash('sha256').update(userId).digest('hex');
const ownerView = user => ({ id: user.id, name: user.name?.trim().slice(0, 100) || 'Tài khoản của bạn' });
const PAGE_SIZE = 30;
const BODY_LIMIT = 4096;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store, max-age=0',
  'Netlify-CDN-Cache-Control': 'no-store',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff'
};

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function atBalance(entries) {
  return entries[0]?.balanceAfter ?? 0;
}

function entryView({ actorId, ...entry }) {
  return entry;
}

function history(entries, query) {
  const from = query.get('from') || '';
  const to = query.get('to') || '';
  const type = query.get('type') || '';
  const after = query.get('after') || '';

  if ((from && !isDate(from)) || (to && !isDate(to)) || (from && to && from > to)) {
    fail(400, 'Chọn khoảng ngày hợp lệ.');
  }
  if (type && !Object.hasOwn(CASH_FUND_TYPES, type)) fail(400, 'Chọn loại phiếu hợp lệ.');
  const start = after ? entries.findIndex(entry => entry.id === after) : -1;
  if (after && (!uuid.test(after) || start < 0)) fail(400, 'Tìm lại để cập nhật lịch sử thu chi.');

  const page = [];
  for (let index = start + 1; index < entries.length && page.length <= PAGE_SIZE; index++) {
    const entry = entries[index];
    if ((!from || entry.date >= from) && (!to || entry.date <= to) && (!type || entry.type === type)) {
      page.push(entryView(entry));
    }
  }
  const hasMore = page.length > PAGE_SIZE;
  if (hasMore) page.pop();
  return { balance: atBalance(entries), entries: page, next: hasMore ? page.at(-1).id : null };
}

async function readReceipt(req, now, userId) {
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    fail(415, 'Dữ liệu cần ở định dạng JSON.');
  }
  if (Number(req.headers.get('content-length')) > BODY_LIMIT) fail(413, 'Nội dung phiếu quá dài.');
  const raw = await req.text();
  if (Buffer.byteLength(raw) > BODY_LIMIT) fail(413, 'Nội dung phiếu quá dài.');
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    fail(400, 'Thông tin phiếu không hợp lệ.');
  }
  const { id, type, amount, date, owner } = body ?? {};
  if (typeof id !== 'string' || !uuid.test(id)) fail(400, 'Mã phiếu không hợp lệ.');
  if (owner !== userId) fail(409, 'Phiên đăng nhập đã thay đổi. Mở lại sổ quỹ trước khi lưu.');
  if (typeof type !== 'string' || !Object.hasOwn(CASH_FUND_TYPES, type)) fail(400, 'Chọn Thu hoặc Chi tiền quỹ.');
  if (!Number.isSafeInteger(amount) || amount <= 0) fail(400, 'Nhập số tiền nguyên lớn hơn 0.');
  if (!isDate(date) || date > vietnamDate(now)) fail(400, 'Ngày phiếu phải từ hôm nay trở về trước.');
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!note || note.length > NOTE_MAX_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)) {
    fail(400, 'Nhập nội dung phiếu, tối đa ' + NOTE_MAX_LENGTH + ' ký tự.');
  }
  return { id, type, amount, date, note };
}

async function saveReceipt(store, receipt, user, now) {
  const key = ledgerKey(user.id);
  // An atomic write keeps the receipt, both balances and its retry ID together.
  for (let attempt = 0; attempt < 8; attempt++) {
    const previous = await store.getWithMetadata(key, { type: 'json' });
    if (previous && (!previous.etag || !Array.isArray(previous.data?.entries))) {
      fail(503, 'Chưa đọc được sổ quỹ. Vui lòng thử lại.');
    }
    const entries = previous?.data.entries ?? [];
    const duplicate = entries.find(entry => entry.id === receipt.id);
    if (duplicate) {
      const sameReceipt = duplicate.actorId === user.id &&
        ['type', 'amount', 'date', 'note'].every(field => duplicate[field] === receipt[field]);
      if (!sameReceipt) fail(409, 'Mã phiếu đã dùng cho nội dung khác.');
      return { record: duplicate, created: false };
    }
    const balanceBefore = atBalance(entries);
    const balanceAfter = balanceBefore + (receipt.type === 'in' ? receipt.amount : -receipt.amount);
    if (balanceAfter < 0) fail(409, 'Số tiền chi vượt số dư quỹ hiện tại.');
    if (!Number.isSafeInteger(balanceAfter)) fail(400, 'Số dư vượt giới hạn tính toán.');
    const name = user.name?.trim();
    const record = {
      ...receipt, balanceBefore, balanceAfter, actorId: user.id,
      actor: name && name !== user.email ? name.slice(0, 100) : 'Thành viên',
      recordedAt: new Date(now).toISOString()
    };
    const condition = previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true };
    const saved = await store.setJSON(key, { entries: [record, ...entries] }, condition);
    if (saved.modified) return { record, created: true };
  }
  fail(409, 'Sổ quỹ vừa thay đổi. Vui lòng lưu lại phiếu.');
}

export function createCashFundHandler(deps) {
  return async function (req) {
    const url = new URL(req.url);
    try {
      if (!['GET', 'POST'].includes(req.method)) fail(405, 'Phương thức không hỗ trợ.');
      if (req.method === 'POST' && req.headers.get('origin') !== url.origin) {
        fail(403, 'Yêu cầu phải gửi từ chính website.');
      }
      if (!deps.production()) fail(503, 'Sổ quỹ hoạt động trên website chính thức.');
      const user = await deps.verify(req);
      if (!user?.id) fail(401, 'Đăng nhập để mở sổ quỹ.');
      if (req.method === 'GET') {
        const ledger = await deps.store().get(ledgerKey(user.id), { type: 'json' });
        if (ledger && !Array.isArray(ledger.entries)) fail(503, 'Chưa đọc được sổ quỹ. Vui lòng thử lại.');
        return Response.json({ ...history(ledger?.entries ?? [], url.searchParams), owner: ownerView(user) }, { headers });
      }

      const now = deps.now?.() ?? Date.now();
      const receipt = await readReceipt(req, now, user.id);
      const { record, created } = await saveReceipt(deps.store(), receipt, user, now);
      return Response.json({ entry: entryView(record), owner: ownerView(user) }, { headers, status: created ? 201 : 200 });
    } catch (error) {
      const message = error.status ? error.message : 'Chưa kết nối được sổ quỹ. Vui lòng thử lại.';
      return Response.json({ error: message }, { headers, status: error.status || 503 });
    }
  };
}
