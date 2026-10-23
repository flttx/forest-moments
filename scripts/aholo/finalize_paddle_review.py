"""Remove superseded search measurements from the delivered prop track."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];path=ROOT/'docs/evidence/assets/2026-10-23-paddle-final/prop-track.json'
old=json.loads(path.read_text());keys=['frame','position','quaternion','pivot','held','regrip','gripTargets']
new={'version':'central-seat-v11-original-paddle-120hz','sourceHashes':old['sourceHashes'],'scale':old['scale'],'sampleFPS':120,'boneOverrides':False,
 'coordinateSystem':'Three Y-up; whole-character assembly shift is applied separately',
 'recoverySupport':'One hand supports the original paddle during recovery; the grip slides toward the handle during extraction.',
 'frames':[{k:r[k] for k in keys} for r in old['frames']]}
assert len(new['frames'])==865 and new['frames'][0]['frame']==0 and new['frames'][-1]['frame']==216
path.write_text(json.dumps(new,indent=2)+'\n',encoding='utf8')
