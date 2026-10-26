"""Subset LXGW WenKai to the characters the HUD actually uses.

Usage: python scripts/build_ui_font.py <dir with LXGWWenKai-Regular.ttf and LXGWWenKai-Medium.ttf>

Source: https://github.com/lxgw/LxgwWenKai/releases/tag/v1.530 (SIL OFL 1.1; the author's
additional permission allows subsetting/converting for web font delivery under the original name).
Rerun whenever UI copy changes: characters missing from the subset fall back to the system font.
"""
import pathlib
import re
import sys

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'fonts'
# Every visible string lives in the dictionary; the HUD sources add the language switch label.
SOURCES = [ROOT / 'src' / 'i18n.ts', *sorted((ROOT / 'src').glob('*Hud.tsx'))]
EXTRA = ''.join(chr(c) for c in range(0x20, 0x7F)) + '·…—–’‘“”、，。！？：；（）《》／'


def used_characters():
    text = ''.join(p.read_text(encoding='utf-8') for p in SOURCES)
    literals = ''.join(re.findall(r"'([^'\n]*)'", text)) + ''.join(re.findall(r">([^<>{}\n]+)<", text))
    chars = {c for c in literals if not c.isspace()} | set(EXTRA)
    return ''.join(sorted(chars))


def build(source_dir: pathlib.Path):
    chars = used_characters()
    OUT.mkdir(parents=True, exist_ok=True)
    for weight in ('Regular', 'Medium'):
        options = subset.Options()
        options.flavor = 'woff2'  # needs the brotli module
        options.layout_features = ['*']
        options.hinting = False
        options.name_IDs = ['*']  # keep copyright and licence records
        options.notdef_outline = True
        font = subset.load_font(str(source_dir / f'LXGWWenKai-{weight}.ttf'), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(text=chars)
        subsetter.subset(font)
        target = OUT / f'wenkai-ui-{weight.lower()}.woff2'
        subset.save_font(font, str(target), options)
        print(f'{target.relative_to(ROOT)}: {target.stat().st_size} B')
    print(f'{len(chars)} characters')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build(pathlib.Path(sys.argv[1]))
