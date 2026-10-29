import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve from this module, never from the caller's cwd or Windows TEMP.
export const projectTempRoot = fileURLToPath(new URL('../.tmp/', import.meta.url))

export async function createProjectTempDirectory(prefix) {
  if (!/^[a-z0-9-]+$/i.test(prefix)) throw new Error('Invalid temporary directory prefix')
  await mkdir(projectTempRoot, { recursive: true })
  return mkdtemp(join(projectTempRoot, prefix))
}

export async function createHeadlessBrowser(args) {
  const profile = await createProjectTempDirectory('forest-moments-headless-')
  const temporary = join(profile, 'tmp')
  await mkdir(temporary)
  const edge = spawn(process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
    ...args,
    // Automated verification is silent; do not play game audio on the user's machine.
    '--mute-audio',
    `--user-data-dir=${profile}`,
    `--disk-cache-dir=${join(profile, 'cache')}`,
    '--disk-cache-size=67108864',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-extensions',
  ], {
    windowsHide: true,
    stdio: 'ignore',
    env: { ...process.env, TEMP: temporary, TMP: temporary, TMPDIR: temporary },
  })
  let cleanupPromise
  let closed = false
  const exited = new Promise((resolve) => {
    edge.once('close', () => { closed = true; resolve() })
    edge.once('error', () => { closed = true; resolve() })
  })
  async function waitForExit(milliseconds) {
    let timer
    try {
      await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(resolve, milliseconds) })])
    } finally { clearTimeout(timer) }
  }
  function cleanup() {
    cleanupPromise ??= (async () => {
      process.removeListener('SIGINT', interrupt)
      process.removeListener('SIGTERM', terminate)
      process.removeListener('beforeExit', onBeforeExit)
      // Only terminate the dedicated browser launched above, never a user's browser.
      if (!closed && edge.exitCode === null && edge.signalCode === null) {
        if (process.platform === 'win32') {
          await new Promise((resolve) => {
            const killer = spawn(join(process.env.SystemRoot ?? 'C:/Windows', 'System32/taskkill.exe'),
              ['/PID', String(edge.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
            killer.once('error', resolve)
            killer.once('close', resolve)
          })
        } else { edge.kill('SIGTERM') }
        await waitForExit(5000)
        if (!closed && edge.exitCode === null && edge.signalCode === null) {
          edge.kill('SIGKILL')
          await waitForExit(5000)
        }
      }
      if (!closed) await waitForExit(1000)
      // The only recursive deletion target is this invocation's mkdtemp result.
      if (dirname(profile) !== projectTempRoot.replace(/[\\/]$/, '')) throw new Error('Unsafe profile path')
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    })()
    return cleanupPromise
  }
  async function stop(code) {
    try { await cleanup() } catch (error) { console.error('Browser profile cleanup failed:', error.message) }
    process.exit(code)
  }
  function interrupt() { void stop(130) }
  function terminate() { void stop(143) }
  function onBeforeExit() {
    void cleanup().catch((error) => { console.error('Browser profile cleanup failed:', error.message); process.exitCode = 1 })
  }
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', terminate)
  process.once('beforeExit', onBeforeExit)
  try {
    await new Promise((resolve, reject) => { edge.once('spawn', resolve); edge.once('error', reject) })
  } catch (error) {
    await cleanup()
    throw error
  }
  return { profile, cleanup }
}
