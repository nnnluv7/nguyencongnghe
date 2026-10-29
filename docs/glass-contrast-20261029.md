# Shared Liquid Glass contrast

The shared NCN theme gives navigation, cards, dialogs, buttons and editor fields
a thin inset contour. Light mode uses charcoal; dark mode uses a pale edge. The
existing inner highlights, brand colors, spacing, shadows and layout remain.
Pressed controls and keyboard focus have stronger, distinct indicators.

This adapts the user's requested dark hairline and the legibility improvements
described on Apple's iOS 27 page: https://www.apple.com/os/ios/?os=app . It does
not claim that Apple requires dark outlines on every component.

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
focus, accessibility preferences, unchanged control/content geometry and
identical FIFO/legacy print pixels. Fixtures never write production data.
