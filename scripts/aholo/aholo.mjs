import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { basename, resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const baseUrl = 'https://api.aholo3d.cn';
const modelOptions = { version: 'G1', faceCount: 300000, outputFormat: ['zip', 'glb'] };

export function unwrap(value) {
  if (value && Object.hasOwn(value, 'c')) {
    if (String(value.c) !== '0') throw new Error(`API business error: ${value.c}`);
    return value.d;
  }
  return value;
}

export function missingBlocks(init, blocks) {
  if (init.deduplicated) return [];
  if (init.lackBlocks == null) return Array.from({ length: blocks }, (_, i) => i + 1);
  return init.lackBlocks.flatMap(value => {
    const match = /^(\d+)(?:-(\d+))?$/.exec(String(value));
    if (!match) throw new Error('Invalid missing-block range');
    const start = Number(match[1]), end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > blocks) throw new Error('Invalid missing-block bounds');
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });
}

async function request(url, headers, body, method = body ? 'POST' : 'GET') {
  // No automatic retry, including POST timeouts and 5xx responses.
  const response = await fetch(url, { method, headers, body, redirect: 'error', signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${new URL(url).pathname}`);
  return unwrap(await response.json());
}

function key() {
  const value = process.env.AHOLO_API_KEY?.trim();
  if (!value) throw new Error('AHOLO_API_KEY is missing from this process. Use run.ps1.');
  return value;
}

async function save(path, value) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await rename(temp, path);
}

export async function reserve(path, value) {
  // Exclusive reservation precedes every network call; even an empty ledger blocks submission.
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}

async function upload(bytes, filename) {
  const token = await request(`${baseUrl}/asset/v1/token`, { Authorization: key() });
  const domain = new URL(token.globalDomain);
  if (domain.protocol !== 'https:' || !token.ousToken || !(token.blockSize > 0)) throw new Error('Invalid upload token response');
  const headers = { 'ous-token-v2': token.ousToken };
  const md5 = createHash('md5').update(bytes).digest('hex');
  const call = (path, body, method) => request(new URL(path, domain), headers, body, method);
  if (bytes.length <= token.blockSize) {
    const form = new FormData();
    form.set('md5', md5);
    form.set('file', new Blob([bytes]), filename);
    await call('/ous/api/v2/single/upload', form);
  } else {
    const blocks = Math.ceil(bytes.length / token.blockSize);
    const query = new URLSearchParams({ md5, blocks: String(blocks), size: String(bytes.length), name: filename });
    const init = await call(`/ous/api/v2/block/upload/init?${query}`, undefined, 'POST');
    const missing = missingBlocks(init, blocks);
    for (const block of missing) {
      if (!Number.isInteger(block) || block < 1 || block > blocks) throw new Error('Invalid upload block index');
      const form = new FormData();
      form.set('block', String(block));
      form.set('file', new Blob([bytes.subarray((block - 1) * token.blockSize, block * token.blockSize)]), filename);
      await call('/ous/api/v2/block/upload/part', form);
    }
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await call('/ous/api/v2/upload/status');
    if (result.status === 5 && result.url) {
      if (result.md5 && result.md5 !== md5) throw new Error('Uploaded MD5 mismatch');
      if (new URL(result.url).protocol !== 'https:') throw new Error('Expected HTTPS image URL');
      return result.url;
    }
    if ([6, 8].includes(result.status)) throw new Error(`Upload failed: ${result.status}`);
    await sleep(1000);
  }
  throw new Error('Upload polling timed out; generation was not submitted');
}

export async function createOnce(ledgerPath, state, send) {
  state.phase = 'submitting';
  await save(ledgerPath, state);
  try {
    const id = await send();
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid task ID');
    state.taskId = id;
    state.phase = 'submitted';
    await save(ledgerPath, state);
    return id;
  } catch (error) {
    state.phase = 'submission_unconfirmed';
    await save(ledgerPath, state);
    throw error;
  }
}

async function submit(imagePath, directory) {
  const bytes = await readFile(imagePath);
  if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('Expected a PNG image');
  key();
  await mkdir(directory, { recursive: true });
  const ledger = join(directory, 'ledger.json');
  const state = { createdAt: new Date().toISOString(), baseUrl, imagePath: resolve(imagePath), imageSha256: createHash('sha256').update(bytes).digest('hex'), imageBytes: bytes.length, options: modelOptions, phase: 'reserved' };
  await reserve(ledger, state);
  await finishUpload(ledger, state, bytes);
}

export function assertMultiResume(state, inputs) {
  if (!['reserved', 'uploaded'].includes(state.phase) || state.taskId || state.operation !== 'multi-image') {
    throw new Error('Multi-image creation may already have started; do not recreate.');
  }
  if (state.baseUrl !== baseUrl || JSON.stringify(state.options) !== JSON.stringify(modelOptions)) {
    throw new Error('Recorded route/options differ.');
  }
  if (!Array.isArray(state.images) || state.images.length < 2 || state.images.length > 32 || inputs.length !== state.images.length) {
    throw new Error('Expected 2-32 matching image inputs.');
  }
  inputs.forEach((bytes, index) => {
    if (createHash('sha256').update(bytes).digest('hex') !== state.images[index].sha256) {
      throw new Error('Multi-image input changed or order differs.');
    }
  });
}

async function submitMulti(manifestPath, directory) {
  const paths = JSON.parse(await readFile(manifestPath, 'utf8')).images;
  if (!Array.isArray(paths) || paths.length < 2 || paths.length > 32 || !paths.every(p => typeof p === 'string')) {
    throw new Error('Expected manifest.images with 2-32 local PNG paths.');
  }
  const inputs = await Promise.all(paths.map(p => readFile(p)));
  for (const bytes of inputs) {
    if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('Expected PNG');
  }
  key();
  await mkdir(directory, { recursive: true });
  const ledger = join(directory, 'ledger.json');
  const state = { createdAt: new Date().toISOString(), baseUrl, operation: 'multi-image',
    options: modelOptions, phase: 'reserved', images: paths.map((path, i) => ({
      path: resolve(path), sha256: createHash('sha256').update(inputs[i]).digest('hex'), bytes: inputs[i].length
    })) };
  await reserve(ledger, state);
  await finishMulti(ledger, state, inputs);
}

async function finishMulti(ledger, state, inputs) {
  assertMultiResume(state, inputs);
  for (const [index, bytes] of inputs.entries()) {
    if (!state.images[index].uploadedUrl) {
      state.images[index].uploadedUrl = await upload(bytes, basename(state.images[index].path));
      await save(ledger, state);
    }
  }
  state.request = { imgs: state.images.map(image => image.uploadedUrl), ...modelOptions };
  state.phase = 'uploaded';
  await save(ledger, state);
  const id = await createOnce(ledger, state, () => request(`${baseUrl}/lux3d/v1/generate/img-to-3d/task/create`,
    { Authorization: key(), 'Content-Type': 'application/json' }, JSON.stringify(state.request)));
  console.log(JSON.stringify({ taskId: id, phase: state.phase, imageCount: inputs.length }));
}

async function resumeMulti(directory) {
  const ledger = join(directory, 'ledger.json');
  const state = JSON.parse(await readFile(ledger, 'utf8'));
  if (!Array.isArray(state.images)) throw new Error('No multi-image inputs recorded');
  const inputs = await Promise.all(state.images.map(image => readFile(image.path)));
  assertMultiResume(state, inputs);
  key();
  await finishMulti(ledger, state, inputs);
}

export function assertUploadResume(state, bytes) {
  if (!['reserved', 'uploaded'].includes(state.phase) || state.taskId) {
    throw new Error('Creation may already have started. Reconcile provider history; do not recreate.');
  }
  if (state.baseUrl !== baseUrl || JSON.stringify(state.options) !== JSON.stringify(modelOptions)) {
    throw new Error('Recorded route/options differ; upload resume blocked.');
  }
  if (createHash('sha256').update(bytes).digest('hex') !== state.imageSha256) {
    throw new Error('Recorded input has changed; upload resume blocked.');
  }
}

async function resumeUpload(directory) {
  const ledger = join(directory, 'ledger.json');
  const state = JSON.parse(await readFile(ledger, 'utf8'));
  const bytes = await readFile(state.imagePath);
  assertUploadResume(state, bytes);
  key();
  state.uploadResumedAt = new Date().toISOString();
  await save(ledger, state);
  await finishUpload(ledger, state, bytes);
}

async function finishUpload(ledger, state, bytes) {
  const imagePath = state.imagePath;
  const img = await upload(bytes, basename(imagePath));
  state.request = { img, ...modelOptions };
  state.phase = 'uploaded';
  await save(ledger, state);
  const id = await createOnce(ledger, state, () => request(`${baseUrl}/lux3d/v1/generate/img-to-3d/task/create`, { Authorization: key(), 'Content-Type': 'application/json' }, JSON.stringify(state.request)));
  console.log(JSON.stringify({ taskId: id, phase: state.phase, ledger }));
}

async function status(directory) {
  const ledgerPath = join(directory, 'ledger.json');
  const state = JSON.parse(await readFile(ledgerPath, 'utf8'));
  if (!state.taskId) throw new Error('No confirmed task ID. Reconcile provider history; do not resubmit.');
  if (!['https://api.aholo.ai', 'https://api.aholo3d.cn'].includes(state.baseUrl)) throw new Error('Untrusted API origin');
  const result = await request(`${state.baseUrl}/lux3d/v1/generate/task/get?taskid=${state.taskId}`, { Authorization: key() });
  await save(join(directory, 'result.json'), result);
  state.lastCheckedAt = new Date().toISOString();
  state.status = result.status;
  state.phase = ({ 0: 'queued', 1: 'running', 3: 'succeeded', 4: 'failed', 6: 'cancelled' })[result.status] ?? 'unknown';
  await save(ledgerPath, state);
  console.log(JSON.stringify({ taskId: state.taskId, phase: state.phase, status: result.status }));
  if ([4, 6].includes(result.status)) throw new Error(`Generation ${state.phase}; details saved to result.json`);
  if (result.status === 3) {
    const files = [];
    for (const [index, output] of (result.outputs ?? []).entries()) {
      if (!output.content?.startsWith('https://')) continue;
      const url = new URL(output.content);
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const ext = bytes.subarray(0, 4).toString() === 'glTF' ? 'glb' : bytes.subarray(0, 2).toString() === 'PK' ? 'zip' : 'bin';
      const filename = `output-${index}.${ext}`;
      await writeFile(join(directory, filename), bytes);
      files.push({ filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    if (!files.length) throw new Error('Successful task has no downloadable files');
    state.files = files;
    await save(ledgerPath, state);
    console.log(JSON.stringify({ downloaded: files }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, first, second] = process.argv.slice(2);
  try {
    if (command === 'submit' && first && second) await submit(first, resolve(second));
    else if (command === 'submit-multi' && first && second) await submitMulti(first, resolve(second));
    else if (command === 'resume-multi' && first) await resumeMulti(resolve(first));
    else if (command === 'resume-upload' && first) await resumeUpload(resolve(first));
    else if (command === 'status' && first) await status(resolve(first));
    else throw new Error('Usage: node aholo.mjs submit <image.png> <new-run-directory> | submit-multi <manifest.json> <new-run-directory> | resume-upload <run-directory> | resume-multi <run-directory> | status <run-directory>');
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'Ledger already exists. Submission blocked; use status or reconcile provider history.' : error.message);
    process.exitCode = 1;
  }
}
