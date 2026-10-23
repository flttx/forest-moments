"""Render local candidates with bounded Blender processes; no API calls."""
import argparse
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--blender', required=True, type=Path)
parser.add_argument('--wmi-fallback', action='store_true')
parser.add_argument('--assets', nargs='+', choices=['raccoon', 'raccoon-multiview', 'workshop', 'lookout', 'canoe'],
                    default=['raccoon', 'workshop', 'lookout', 'canoe'])
parser.add_argument('--timeout', type=int, default=600, help='Seconds per asset')
parser.add_argument('--variant', choices=['raw', 'optimized-v1', 'optimized-v2', 'material-v1', 'tail-repair-v1', 'tail-repair-v2', 'tail-repair-v3', 'tail-repair-v4', 'tail-repair-v5', 'surface-v1', 'rig-v1', 'structure-v1'], default='raw')
parser.add_argument('--clay', action='store_true')
parser.add_argument('--tail-closeup', action='store_true')
parser.add_argument('--views', nargs='+', choices=['front', 'three-quarter', 'side', 'back', 'left', 'elevated', 'bottom'])
args = parser.parse_args()
env = dict(os.environ)
command = [str(args.blender.resolve()), '--background', '--factory-startup',
           '--disable-autoexec', '--threads', '8', '--python-exit-code', '1']
if args.wmi_fallback:
    env.pop('PYTHONHOME', None)
    env['PYTHONPATH'] = str(Path(__file__).parent / 'blender_bootstrap')
    env['PYTHONNOUSERSITE'] = '1'
    env['FOREST_BLENDER_WMI_FALLBACK'] = '1'
    command.append('--python-use-system-env')
for asset in args.assets:
    output = ROOT / 'docs/evidence/assets/2026-10-22-round-01' / asset
    if args.variant != 'raw':
        output = output / args.variant
    if args.clay:
        output = output / 'clay'
    if args.tail_closeup:
        output = output / 'tail-closeup'
    output.mkdir(parents=True, exist_ok=True)
    print(f'Rendering {asset}', flush=True)
    with (output / 'render.log').open('w', encoding='utf-8') as log:
        options = ['--', asset, '--variant', args.variant]
        if args.clay:
            options.append('--clay')
        if args.tail_closeup:
            options.append('--tail-closeup')
        if args.views:
            options += ['--views', *args.views]
        subprocess.run(command + ['--python', str(Path(__file__).with_name('render_review.py')),
                                  *options], cwd=ROOT, env=env, stdout=log,
                       stderr=subprocess.STDOUT, check=True, timeout=args.timeout)
    print(f'Rendered {asset}', flush=True)
