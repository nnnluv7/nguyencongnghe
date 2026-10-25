# Admin hub and library management

The verified ADMIN navigation entry opens `/admin/`. The hub is a single entry
point for Library, announcements, VIP/payment, Event and GVGS management. New
modules can be added to `netlify/lib/ncn-library/admin-hub.html` without adding
more public navigation items. Guests and VIP members do not see this entry.

`/admin/thu-vien/` opens the Library editor. It supports hosted articles and link
entries, editing metadata, safe formatted content with previews, publication,
unlisting, drafts, trash and restore. Existing tools/print pages support listing
metadata and listing removal while their functionality and original URLs remain
protected.

## Visibility and removal

- Published: appears in the public catalogue and can be opened directly.
- Hidden: removed from Library results; the direct page remains public.
- Draft: not in public results and the hosted page returns 404.
- Trash: recoverable. A new hosted article returns 410. For a legacy article,
  the editor explicitly separates listing-only removal from also disabling the
  original page. Restore recovers the prior visibility and article content.

Disabling a legacy page covers `.html`, extensionless and trailing-slash routes.
Original repository files are retained, so selecting the original-content mode
also recovers the source content after an Admin has written a replacement.
External sites are never deleted by removing a link entry.

## Server boundary

The existing Netlify Identity verification reads server `app_metadata.roles`.
Every private screen, detail read and write requires ADMIN; browser hints,
user metadata, client-supplied roles and VIP access cannot authorize changes.
Writes additionally require the website Origin and a matching item version.
The UI removes private forms on logout or an authorization rejection.

The `ncn-site-library-v1` Blobs store contains a conditional `index` and immutable
body records. A body is written before its index pointer. The conditional index
write is the publish point; stale writes cannot overwrite a newer article.
Public catalogue responses contain only published metadata and never body keys,
draft bodies or creator information.

The homepage replaces the welcome panel with the three newest published Library
articles, ordered by publication date. Drafts, hidden/trash entries and tool
shortcuts are excluded; a newly published article automatically joins this feed.
The cards retain Liquid Glass styling and stack compactly on phones.

The homepage, public library landing and 40 legacy article/resource pages are routed
through `ncn-library-page`, returning the current HTML before browser rendering.
The 77 baseline entries, original files, print renderers, download destinations
and business-tool endpoints remain in the repository. The original editable
article text also retains all 21 resource download links.

New content accepts passive formatted text rather than executable HTML. One
shared renderer escapes HTML, validates link/image protocols and is used by both
the editor preview and the public article response. Existing original HTML is
served unchanged unless the Admin explicitly selects replacement content.

## Verification

`node --test tests/*.test.cjs tests/*.test.mjs` covers authorization, content
states, conflicts, original-content recovery, route aliases and unsafe inputs.
`node tests/browser/ncn-library-admin.mjs` uses synthetic HTTPS users and a memory
store with real handlers. It exercises the management UI, all content lifecycle
actions and desktop/mobile layouts. It performs no production writes.

The Admin browser workflow also compiles both Netlify function bundles. The
existing account, general UI, complete library and print-template suites remain
in place.
