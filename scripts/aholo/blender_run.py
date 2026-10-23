"""Run one local pipeline script in an isolated Blender process with a timeout."""
import argparse
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('script', type=Path)
parser.add_argument('--blender', type=Path, required=True)
parser.add_argument('--timeout', type=int, default=600)
args, options = parser.parse_known_args()
environment = dict(os.environ)
environment.pop('PYTHONHOME', None)
environment['PYTHONPATH'] = str(Path(__file__).parent / 'blender_bootstrap')
environment['PYTHONNOUSERSITE'] = '1'
environment['FOREST_BLENDER_WMI_FALLBACK'] = '1'
command = [str(args.blender.resolve()), '--background', '--factory-startup', '--disable-autoexec',
           '--threads', '8', '--python-exit-code', '1', '--python-use-system-env',
           '--python', str(args.script.resolve()), '--', *options]
subprocess.run(command, cwd=ROOT, env=environment, check=True, timeout=args.timeout)
