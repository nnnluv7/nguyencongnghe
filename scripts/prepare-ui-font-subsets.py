"""Recreate the UI font files; requires fonttools and the npm build dependencies.

Only the common Latin/Vietnamese characters receive a small first-load font.
CSS retains the complete original font for every other Unicode character.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
dest = root / 'public/assets/ncn-theme/font-subsets'
dest.mkdir(parents=True, exist_ok=True)
ranges = [(0, 0x17f), (0x1a0, 0x1a1), (0x1af, 0x1b0), (0x300, 0x36f),
          (0x1ea0, 0x1ef9), (0x2000, 0x206f), (0x20a0, 0x20cf),
          (0x2190, 0x2199), (0x21a9, 0x21aa), (0x21bb, 0x21bb), (0x2212, 0x2212),
          (0x2318, 0x2318), (0x2325, 0x2325), (0x232b, 0x232b), (0x23ce, 0x23ce),
          (0x25b2, 0x25bd), (0x2605, 0x2606), (0xfeff, 0xfeff), (0xfffd, 0xfffd)]
def css_ranges(values):
    return ','.join('U+%X' % a + ('-%X' % b if a != b else '') for a, b in values)
def contiguous(values):
    result = []
    for value in sorted(values):
        if result and value == result[-1][1] + 1:
            result[-1] = (result[-1][0], value)
        else:
            result.append((value, value))
    return result
complement, start = [], 0
for a, b in ranges:
    if start < a:
        complement.append((start, a - 1))
    start = b + 1
complement.append((start, 0x10ffff))
manifest = {'unicodeRange': css_ranges(ranges), 'complementaryRange': css_ranges(complement), 'fonts': {}}
css = (root / 'public/assets/vendor/e8a621bed82faf2b49.css').read_text()
with tempfile.TemporaryDirectory(prefix='ncn-ui-fonts-') as temporary:
    for source in re.findall(r'url\((/assets/[^)]+\.ttf)\)', css):
        original = root / ('public' + source)
        font = TTFont(original, recalcTimestamp=False)
        cmap = font.getBestCmap()
        characters = {u for u in cmap if any(a <= u <= b for a, b in ranges)}
        widths = {u: font['hmtx'][cmap[u]] for u in characters}
        options = subset.Options()
        options.layout_features = ['*']
        options.name_IDs = ['*']
        options.name_legacy = True
        options.name_languages = ['*']
        options.notdef_outline = True
        worker = subset.Subsetter(options=options)
        worker.populate(unicodes=characters)
        worker.subset(font)
        assert set(font.getBestCmap()) == characters
        assert all(font['hmtx'][font.getBestCmap()[u]] == widths[u] for u in characters)
        interim = Path(temporary) / original.name
        font.save(interim)
        filename = original.stem + '.woff2'
        subprocess.run(['node', '-e', 'const f=require("fs"),w=require("wawoff2");w.compress(f.readFileSync(process.argv[1])).then(b=>f.writeFileSync(process.argv[2],b));', str(interim), str(dest / filename)], cwd=root, check=True)
        manifest['fonts'][source] = {'file': '/assets/ncn-theme/font-subsets/' + filename,
                                    'sourceSHA256': hashlib.sha256(original.read_bytes()).hexdigest(),
                                    'fallbackRange': css_ranges(contiguous(set(cmap) - characters)),
                                    'characters': len(characters)}
        print(filename, (dest / filename).stat().st_size)
(dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
