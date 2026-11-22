// Netlify Blobs-compatible store backed by Cloudflare D1 + R2.
//
// The site's lib code was written against the @netlify/blobs API and relies on
// compare-and-swap through etags (getWithMetadata + setJSON({onlyIfMatch})),
// which Cloudflare KV cannot reproduce. D1 reproduces it exactly with atomic
// conditional statements (INSERT ... ON CONFLICT DO NOTHING for onlyIfNew,
// UPDATE ... WHERE etag = ? for onlyIfMatch), so no lib code needs to change.
//
// Layout:
// - D1 table `blobs` (see schema.sql): one row per key across all 12 stores.
//   JSON/text values are stored inline in `value`; binary values store only a
//   metadata row (kind='binary', value NULL) and the payload goes to R2 at
//   `<store>/<key>`, so list/getMetadata/CAS work uniformly for both kinds.
// - etag is a fresh random UUID on every successful write. Callers only ever
//   compare etags for equality, so monotonicity is not required.
//
// Write ordering for binary keys: the D1 conditional write runs FIRST (it is
// the atomic arbiter), then the R2 put. If the R2 put fails after a successful
// D1 write, the row is left dangling; get() then returns null and the
// callers' CAS retry loops re-read and rewrite, which self-heals.

const PAGE_SIZE = 100;

function isBinary(data) {
  return data instanceof ArrayBuffer || ArrayBuffer.isView(data);
}

function toUint8(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}

function escapeLike(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export class D1BlobsStore {
  constructor(db, bucket, name) {
    this.db = db;
    this.bucket = bucket;
    this.name = name;
  }

  _r2Key(key) {
    return this.name + '/' + key;
  }

  async _row(key) {
    return this.db.prepare(
      'SELECT kind, value, etag, metadata FROM blobs WHERE store = ? AND key = ?'
    ).bind(this.name, key).first();
  }

  // Resolve a stored row to the value the caller asked for. `type` follows the
  // Blobs convention: 'json' parses, 'arrayBuffer' returns bytes, anything
  // else (or omitted) returns the stored text. Returns null only when the row
  // itself is missing; a binary row whose R2 object is gone resolves to null
  // data (see getWithMetadata for why the etag is still returned there).
  async _resolve(row, type) {
    if (!row) return null;
    if (row.kind === 'binary') {
      if (!this.bucket) throw new Error('Missing R2 binding NCN_BUCKET for binary store reads');
      const object = await this.bucket.get(this._r2Key(row.key ?? ''));
      if (!object) return null;
      const bytes = await object.arrayBuffer();
      if (type === 'json') return JSON.parse(new TextDecoder().decode(bytes));
      if (type === 'arrayBuffer' || !type) return bytes;
      return new TextDecoder().decode(bytes);
    }
    const text = row.value ?? '';
    if (type === 'json') return JSON.parse(text);
    if (type === 'arrayBuffer') return new TextEncoder().encode(text).buffer;
    return text;
  }

  async get(key, options = {}) {
    const row = await this._row(key);
    if (!row) return null;
    // _resolve needs the key for the R2 lookup; attach it without mutating the row shape callers see.
    return this._resolve({...row, key}, options.type);
  }

  async getWithMetadata(key, options = {}) {
    const row = await this._row(key);
    if (!row) return null;
    const data = await this._resolve({...row, key}, options.type);
    // A binary row whose R2 object is missing still returns its etag, so a
    // CAS writer can overwrite it (onlyIfMatch) instead of spinning forever
    // on onlyIfNew against a row that already exists.
    return {data, etag: row.etag};
  }

  async getMetadata(key) {
    const row = await this._row(key);
    if (!row) return null;
    let metadata = null;
    if (row.metadata) {
      try { metadata = JSON.parse(row.metadata); } catch { metadata = null; }
    }
    return {metadata, etag: row.etag};
  }

  async setJSON(key, data, options = {}) {
    return this._write(key, 'json', JSON.stringify(data), null, options);
  }

  async set(key, data, options = {}) {
    if (typeof data === 'string') return this._write(key, 'text', data, null, options);
    if (isBinary(data)) return this._write(key, 'binary', null, toUint8(data), options);
    return this._write(key, 'json', JSON.stringify(data), null, options);
  }

  async _write(key, kind, value, bytes, options = {}) {
    const etag = crypto.randomUUID();
    const metadata = options.metadata ? JSON.stringify(options.metadata) : null;
    const now = Date.now();
    let result;
    if (options.onlyIfNew) {
      result = await this.db.prepare(
        'INSERT INTO blobs (store, key, kind, value, etag, metadata, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(store, key) DO NOTHING'
      ).bind(this.name, key, kind, value, etag, metadata, now).run();
    } else if (options.onlyIfMatch) {
      result = await this.db.prepare(
        'UPDATE blobs SET kind = ?, value = ?, etag = ?, metadata = ?, updated_at = ? WHERE store = ? AND key = ? AND etag = ?'
      ).bind(kind, value, etag, metadata, now, this.name, key, options.onlyIfMatch).run();
    } else {
      result = await this.db.prepare(
        'INSERT INTO blobs (store, key, kind, value, etag, metadata, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(store, key) DO UPDATE SET kind = excluded.kind, value = excluded.value, etag = excluded.etag, metadata = excluded.metadata, updated_at = excluded.updated_at'
      ).bind(this.name, key, kind, value, etag, metadata, now).run();
    }
    const modified = (result.meta?.changes ?? 0) > 0;
    if (!modified) return {modified: false};
    if (kind === 'binary') {
      if (!this.bucket) throw new Error('Missing R2 binding NCN_BUCKET for binary store writes');
      await this.bucket.put(this._r2Key(key), bytes);
    } else if (this.bucket) {
      // Overwriting a binary key with JSON/text: drop the now-stale R2 object.
      // Best-effort; the D1 write already succeeded, so never fail the call.
      await this.bucket.delete(this._r2Key(key)).catch(() => {});
    }
    return {modified: true};
  }

  async delete(key) {
    await this.db.prepare(
      'DELETE FROM blobs WHERE store = ? AND key = ?'
    ).bind(this.name, key).run();
    if (this.bucket) await this.bucket.delete(this._r2Key(key)).catch(() => {});
  }

  // Mirrors the Blobs list(): without `paginate` it returns a Promise of
  // {blobs:[{key,etag}]} for the whole prefix; with `paginate:true` it returns
  // an async iterator of {blobs} pages (used as `for await` in lib code).
  list({prefix = '', paginate = false} = {}) {
    if (paginate) return this._listPages(prefix);
    return this._listAll(prefix);
  }

  async _listAll(prefix) {
    const {results} = await this.db.prepare(
      "SELECT key, etag FROM blobs WHERE store = ? AND key LIKE ? ESCAPE '\\' ORDER BY key ASC"
    ).bind(this.name, escapeLike(prefix) + '%').all();
    return {blobs: (results || []).map(({key, etag}) => ({key, etag}))};
  }

  async *_listPages(prefix) {
    let after = null;
    for (;;) {
      const {results} = await this.db.prepare(
        after === null
          ? "SELECT key, etag FROM blobs WHERE store = ? AND key LIKE ? ESCAPE '\\' ORDER BY key ASC LIMIT ?"
          : "SELECT key, etag FROM blobs WHERE store = ? AND key LIKE ? ESCAPE '\\' AND key > ? ORDER BY key ASC LIMIT ?"
      ).bind(
        ...(after === null
          ? [this.name, escapeLike(prefix) + '%', PAGE_SIZE]
          : [this.name, escapeLike(prefix) + '%', after, PAGE_SIZE])
      ).all();
      const blobs = (results || []).map(({key, etag}) => ({key, etag}));
      if (!blobs.length) return;
      yield {blobs};
      if (blobs.length < PAGE_SIZE) return;
      after = blobs.at(-1).key;
    }
  }
}

// Drop-in replacement for Netlify's getStore({name, consistency}) factory.
// `env` is the Pages Functions env: NCN_DB (D1) is required, NCN_BUCKET (R2)
// is required for any store holding binary values (stories, avatars, audio).
export function createStoreFactory(env) {
  if (!env?.NCN_DB) throw new Error('Missing D1 binding NCN_DB');
  return function getStore(name) {
    return new D1BlobsStore(env.NCN_DB, env.NCN_BUCKET || null, name);
  };
}
