import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { reserve, createOnce, unwrap, missingBlocks, assertUploadResume, assertMultiResume } from './aholo.mjs';

const directory = await mkdtemp(join(tmpdir(), 'aholo-check-'));
try {
  const ledger = join(directory, 'ledger.json');
  await reserve(ledger, { original: true });
  await assert.rejects(reserve(ledger, {}), { code: 'EEXIST' });
  assert.equal(JSON.parse(await readFile(ledger)).original, true);
  let attempts = 0;
  await assert.rejects(createOnce(ledger, {}, async () => { attempts++; throw new Error('ambiguous network timeout'); }));
  assert.equal(attempts, 1);
  assert.equal(JSON.parse(await readFile(ledger)).phase, 'submission_unconfirmed');
  await assert.rejects(reserve(ledger, {}), { code: 'EEXIST' });
  assert.equal(unwrap({ c: '0', d: 123 }), 123);
  assert.throws(() => unwrap({ c: 'QUOTA_EXCEEDED', d: null }));
  assert.deepEqual(missingBlocks({ lackBlocks: ['1-3', '5'] }, 5), [1, 2, 3, 5]);
  assert.throws(() => missingBlocks({ lackBlocks: ['1-999999'] }, 5));
  assert.deepEqual(missingBlocks({ deduplicated: true }, 5), []);
  const input = Buffer.from('unchanged input');
  const resumable = {phase:'reserved', baseUrl:'https://api.aholo3d.cn', options:{version:'G1',faceCount:300000,outputFormat:['zip','glb']}, imageSha256:createHash('sha256').update(input).digest('hex')};
  assertUploadResume(resumable, input);
  assertUploadResume({...resumable,phase:'uploaded'}, input);
  for (const phase of ['submitting','submission_unconfirmed','submitted','running','succeeded']) {
    assert.throws(()=>assertUploadResume({...resumable,phase},input));
  }
  assert.throws(()=>assertUploadResume({...resumable,taskId:123},input));
  assert.throws(()=>assertUploadResume(resumable,Buffer.from('changed input')));
  assert.throws(()=>assertUploadResume({...resumable,baseUrl:'https://api.aholo.ai'},input));
  assert.throws(()=>assertUploadResume({...resumable,options:{}},input));
  const second = Buffer.from('side view');
  const multi = {...resumable, operation:'multi-image', images:[input,second].map(bytes=>({sha256:createHash('sha256').update(bytes).digest('hex')}))};
  assertMultiResume(multi,[input,second]);
  assert.throws(()=>assertMultiResume(multi,[second,input]));
  assert.throws(()=>assertMultiResume(multi,[input]));
  for (const phase of ['submitting','submission_unconfirmed','submitted','running','succeeded']) {
    assert.throws(()=>assertMultiResume({...multi,phase},[input,second]));
  }
  assert.throws(()=>assertMultiResume({...multi,taskId:123},[input,second]));
  console.log('PASS: exclusive ledger, preservation, one POST attempt, ambiguous-state guard, API business-code checks');
} finally {
  await rm(directory, { recursive: true });
}
