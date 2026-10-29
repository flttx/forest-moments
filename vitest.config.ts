import {configDefaults,defineConfig,mergeConfig} from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig,defineConfig({
 test:{exclude:[...configDefaults.exclude,'.tmp/**'],maxWorkers:process.platform==='win32'?2:undefined},
}))
