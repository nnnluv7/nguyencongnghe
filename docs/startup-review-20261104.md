# Startup review — 4 November 2026

Reviewed the current main branch at `29fcd64c573f33a180d8a5e2662a1f32c9f0e021`,
including the recent header, VIP-role, AdSense, Donate and File kho changes.

The generated import map drops from 13,001 to 203 bytes per page. Compiled
modules already import content-hashed chunks; the two source aliases used by
unbundled account/Excel code remain. UTF-8 metadata precedes the resource hints
instead of appearing about 15 KB into the deployed homepage.

Tool/game shells fetch announcements without first reading the article index
and RSS catalogue. Global search loads articles when opened, reuses a successful
response and keeps the existing VIP filters. Home, Library and legacy search
retain complete server data. Failed public shells remain uncached.

Informational articles omit unused Blogger/jQuery and tool startup libraries;
print and utility pages retain their own dependencies. YouTube embeds preserve
their URLs and geometry and use native lazy loading. Escape no longer throws
when a modern page omits jQuery. The supplied AdSense loader, its single reading
banner, account rules, CSS and print assets retain their current behavior.

Validation: all 122 compiled pages pass resource, integrity and import-map
checks. Comparing the old and new optimizer on all 122 sources preserves
visible markup, apart from the inert video loading attribute. No CSS source is
modified. The existing unit suite and four new startup regressions pass;
compiled browser CI also exercises on-demand search, guest VIP filtering,
reopening search and Escape.

The deployed WPS article opened normally in the browser during this review.
An earlier production CI scan received HTTP 403 on that route; this is recorded
as a live-check limitation rather than hidden by weakening the assertions.
