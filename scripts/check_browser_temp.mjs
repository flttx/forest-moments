// Real browser lifecycle regression; safe to launch from outside the project.
import assert from 'node:assert/strict'
import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createHeadlessBrowser, projectTempRoot } from './browser-session.mjs'

const args = ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank']
const profiles = async () => (await readdir(projectTempRoot)).filter(name => name.startsWith('forest-moments-headless-')).sort()
async function waitForBrowser(profile) {
  for (let i = 0; i < 100; i++) {
    try {
      const port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]
      const result = await fetch(`http://127.0.0.1:${port}/json/version`)
      assert(result.ok)
      return await result.json()
    } catch { await new Promise(resolve => setTimeout(resolve, 100)) }
  }
  throw new Error('Browser did not start')
}

const checks = []
const first = await createHeadlessBrowser(args)
let second
try {
  assert.equal(dirname(first.profile), projectTempRoot.replace(/[\\/]$/, ''))
  const version = await waitForBrowser(first.profile)
  checks.push({ name: 'Browser starts with a project-local profile from any cwd', browser: version.Browser })
  second = await createHeadlessBrowser(args)
  await waitForBrowser(second.profile)
  assert.notEqual(first.profile, second.profile)
  await first.cleanup()
  await first.cleanup()
  await assert.rejects(access(first.profile), { code: 'ENOENT' })
  await access(second.profile)
  checks.push({ name: 'Parallel profiles stay isolated and repeated cleanup is safe' })
  try {
    // A failed report write must not prevent the outer finally from disposing Edge.
    await writeFile(join(second.profile, 'missing-parent', 'report.json'), '{}')
  } catch (error) { assert.equal(error.code, 'ENOENT') }
  finally { await second.cleanup() }
  await assert.rejects(access(second.profile), { code: 'ENOENT' })
  checks.push({ name: 'Browser and profile are cleaned even after a report write failure' })
} finally {
  await first.cleanup()
  if (second) await second.cleanup()
}

const before = await profiles()
const originalEdge = process.env.EDGE_PATH
try {
  process.env.EDGE_PATH = join(projectTempRoot, 'nonexistent-browser.exe')
  await assert.rejects(createHeadlessBrowser(args), { code: 'ENOENT' })
  assert.deepEqual(await profiles(), before)
  checks.push({ name: 'Startup failure leaves no profile behind' })
} finally {
  if (originalEdge === undefined) delete process.env.EDGE_PATH
  else process.env.EDGE_PATH = originalEdge
}
console.log(JSON.stringify({ status: 'PASS', checks }, null, 2))
