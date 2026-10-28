# Inter UI subsets

Generated from the existing eight Inter TTF files under `assets/vendor/`.
Copyright and license metadata are retained. The small font covers common
Latin and Vietnamese text; the CSS build retains the complete original font
for every other Unicode character. Print layout source files are unchanged.

Recreate with `python scripts/prepare-ui-font-subsets.py` after installing
FontTools and the project's npm dependencies. Normal Netlify builds use these
generated WOFF2 files and need no Python packages.
