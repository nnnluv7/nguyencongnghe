# Pikachu: iPhone painting and classic character artwork

The old renderer rebuilt all 80 buttons and their external SVG `<use>` trees
after every successful pair, including characters that had not moved. Tiles,
the SVG connection glow and the containing glass panel also used paint filters.
These were plausible contributors to the reported full-board white flash on
iPhone; a desktop renderer does not reproduce every physical iPhone GPU issue.

## Resulting behavior

- Tile buttons and their picture nodes persist while board geometry is the
  same. A match hides the removed pair; gravity and shuffling change only the
  affected character positions/types. The path overlay is retained, and normal
  matches do not request a fullscreen resize.
- Twenty original full-body vector characters replace the face-only portraits,
  retaining the existing species order and IDs. This gives the familiar PC Onet
  feel while keeping Pikachu, Pichu, tails, shells, leaves and body shapes distinct
  at phone tile sizes.
- The editable `tiles.svg` is exported to one lossless WebP texture with twenty
  256 × 256 cells. The content-hashed URL is discovered in the page head and
  cached immutably. Pictures are decoded before being revealed; readable
  species labels keep the game playable if the image cannot load.
- Tile hover effects apply only to a fine pointer. Matching fades the selected
  pair without scaling, rotating or filtering every SVG surface. The path glow
  uses a plain translucent stroke, and the active game panel does not blur its
  backdrop. The site's Liquid Glass toolbar, colors, rounded surfaces and
  normal/fullscreen layouts remain.
- The game/save version, thirty stages, species IDs, scores, shared profiles,
  public leaderboard and saved-game rules are unchanged.

## Reproducible assets and validation

`node scripts/build-pikachu-art.mjs` exports the current master, updates
`tile-art.css` and the image preload, and retires only old generated textures.
The normal public build runs this step before copying/minifying assets.

`tests/ncn-pikachu-art.test.mjs` checks the twenty distinct symbol IDs, vector
source fingerprint, atlas dimensions/alpha, content hash, preload and caching.

`tests/browser/ncn-pikachu-art.mjs` exercises the actual compiled game with a
Retina touch viewport in both Chromium and WebKit. It compares painted pixels of
an unaffected Pikachu and another species over ten frames spanning a match and
the board update, while checking DOM identity and no new texture requests. Other
cases cover gravity, hints, shuffling, saved runs, rotation, short screens, dark
mode, reduced motion and image failure. All API responses use synthetic data;
the fixtures cannot create production accounts or submit production scores.

```sh
node scripts/build-public.mjs
node --test tests/ncn-pikachu*.test.mjs
node tests/ncn-performance-build.mjs
NCN_BUILT_TEST=1 node tests/browser/ncn-pikachu-art.mjs
NCN_BUILT_TEST=1 NCN_BROWSER=webkit node tests/browser/ncn-pikachu-art.mjs
node tests/browser/ncn-pikachu.mjs
node tests/browser/ncn-pikachu-screen.mjs
```

The Pikachu workflow installs both browser engines and their Linux libraries.
WebKit tests emulate iPhone input/viewport characteristics; physical iPhone
hardware and its OS compositor are not available in this environment.
