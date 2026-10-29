# Shared Liquid Glass hairlines

The shared NCN theme retains the original glass colors, white highlights,
shadows, control styles, spacing and rounded shapes. Existing borders receive
a subtle gray tint: 8.5% opacity on light panels, 14% on light search/navigation
controls; dark mode uses 12% and 19% pale edges respectively.

Each component keeps its own border and radius. No additional resting outline
is painted over it. Generic buttons, text actions, summary rows and nested
search inputs receive no new frame. Existing focus and selected indicators
remain in their original component styles. This follows the user's supplied
search-field reference and preference for the earlier interface.

The change is CSS only. No new requests, JavaScript, blur layers or animation
are introduced. The shared compiled stylesheet is reused across all 121 pages.
Reduce Transparency and Increase Contrast preferences strengthen the edges and
replace translucent chrome with opaque material. Forced Colors retains native
system colors.

All refinements are inside screen media queries. Paper artwork, transparent
print inputs, FIFO labels and Pikachu tiles retain their own styles. Nested VIP
editor panels that intentionally have no frame stay unframed.

Validation:

- `node scripts/build-public.mjs`
- `node tests/ncn-performance-build.mjs`
- `node --test tests/*.test.mjs`
- `NCN_BUILT_TEST=1 node tests/browser/ncn-layout.mjs`
- `NCN_BUILT_TEST=1 node tests/browser/ncn-account.mjs`
- `NCN_BUILT_TEST=1 node tests/browser/ncn-fifo.mjs`
- `node tests/browser/ncn-glass.mjs`

The glass browser fixture compares the final compiled CSS against the same
bundle with only this refinement removed. It checks desktop/phone themes,
focus, accessibility preferences, unchanged geometry, radii and shadows, and
identical FIFO/legacy print pixels. Fixtures never write production data.
