# NCN Blast touch dragging and desktop size · 30 October 2026

The drag ghost was absolutely positioned without a `left` or `top`. Its transform was calculated from the play frame, while CSS started it after the footer. On a normal 390×844 touch page, the first-row target was near y=200 and the visible dragged piece appeared near y=764. The earlier tests checked visibility and the eventual score without checking the ghost’s actual coordinates.

Anchor the ghost at the play frame origin and account for the frame border. The moving blocks now match the preview above the finger, including after scrolling, on normal phone pages and fullscreen. Suppress selection/callouts on draggable pieces. Track pointer moves and releases on the document so a browser refusing explicit pointer capture can still complete the gesture. Cancellation leaves the board and save unchanged.

For desktop, increase the normal board range from 330–560px to 480–760px, remove the shared-header height from the size calculation, increase labels, controls and tray art, and lift the large-screen fullscreen cap from 650px to 950px. Keep the phone layout and approved Liquid Glass shell. Fullscreen still fits the viewport in both phone orientations and on short desktops.

Regression coverage now checks actual ghost coordinates against the intended cells, rather than merely checking `isVisible()`. Genuine touch drags cover normal 320×568, 375×667, 390×844 and 412×915 pages, selected-then-dragged pieces, row clearing, scrolling and cancelled touches. A separate capture-refusal case and desktop size assertions guard both reported problems. The dedicated suite contains 18 browser scenarios and runs against source and compiled assets. Engine and scores behavior remains covered by the existing 43 tests.

The enlarged tray also uses explicit zero-minimum grid tracks for its artwork. Auto grid tracks let long SVG shapes grow the implicit row/column, so percentage bounds did not constrain them. The regression suite renders all 29 shapes in the actual tray at desktop, 390px and 320px widths and checks containment without hiding or clipping any tiles.
