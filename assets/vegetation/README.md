# 植被迁移产物（2026-10-24）

只读来源：`F:/Projects/my-blog`，源提交 `14d4c1d1621f5e4528e82c25ef54fb7d7c1ff22c`。

- 运行资产：`public/assets/vegetation/forest-kit.glb`、`forest-kit-lod.glb`、`lantern-glow.webp`，合计 1,179,638 B。
- 本目录的 `source-*.glb` 是生产包副本；`forest-kit*.glb` 是迁移归档和供 Blender 读取的未压缩检查版，均留本机。`template-review.blend` 为独立对照场景，未进入 public/dist。
- `node scripts/extract_vegetation.cjs F:/Projects/my-blog` 从该项目既有 glTF Transform 4.5 / Meshoptimizer 开发工具读取生产包，提取六类模板、移除旧岛实例与无关资源、保留量化网格和纹理，并生成本项目碰撞元数据。没有新增运行时依赖。
- `scripts/audit_vegetation_blender.py` 通过本地 Blender 5.2.1 LTS 比较原 Blender 网格和迁移版的尺寸/原点，检查 UV、法线和面数。使用 `scripts/aholo/blender_run.py` 启动独立后台进程；本机程序位于 `D:/Program Files/Blender Foundation/Blender 5.2/blender.exe`。
- `/scripts/vegetation-review.html?kit=normal-pine-b` 为开发服务器上的并排浏览器复核页。支持六类 kit，路灯可加 `&night`；不进入生产构建。

本轮用户授权的是本地复用。原任务为 Tripo + Blender 制作，不是新增 Lux3D 产物，没有生成或积分消费；商业授权未重新独立核实。逐件任务 ID、源路径、哈希、贴图尺寸与字节数见 `docs/evidence/vegetation-expansion/2026-10-24/asset-manifest.json`。

原源码 `GroundCover.tsx`、`FoliageFade.tsx`、`NightLights.tsx`、`lampAnchors.ts` 和分块/LOD 方案已按本项目地形、Zustand 玩家位置与三时段预设适配，未引入博客、牧场任务或原岛碰撞系统。
