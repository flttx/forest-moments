# 工坊室内与木墩修整 · 2026-10-24

本轮目标由“工坊材料与制作”收敛为用户明确要求的可进入室内工坊。主稿为 [PROJECT_REPORT.md 第 5.33 节](../../report/PROJECT_REPORT.md)，包含参考、设计决策、未采用版和实际对比。

## 资产与实现

- 沿用 my-blog 历史完整工坊室内（Tripo 单体 + Blender 房间和烘焙），没有调用新生成服务，没有费用。室内 GLB + 六光照图共 1686656 B；原文件逐字节复用。来源、任务 ID、纹理/网格、哈希见 [interior-assets.json](interior-assets.json)。两张既有参考及任务来源见 [sources.json](sources.json)。
- 完整室内：墙窗、地板、灯、地毯、工作台、工具架、炉灶、柴堆、桶袋和置物架。原 15 个家具/墙体 Collider 导出为 `src/game/workshopColliders.json`，家具碰撞与小步滑动使用独立室内坐标。
- 正门 F 进入、门厅落脚、室内移动、三次修整、成品可见且有碰撞、门口 F 原位返回；遮罩中点切换不是开门跨门动画。刷新回小岛，旧木墩和成品阶段保存在本地。
- 采集可取消；制作失败/取消不消耗材料、重复 F 不重复计数、保存失败保持本次会话可玩。专用木工手部动作、砂块/工具、木面变形、坐凳、自由布置与经营库存尚未实现。

## 迭代与失败保留

1. `before/` 是修改前的 8 张昼间场景图。
2. `layout-v1/` 是未采用的门外工作区（3 张）。初版工作台阻断门前路，单测两项失败；移到侧面后恢复。用户要求进入室内，最终撤回门外工作台、碰撞及两件独立下载文件。
3. Blender MCP 找不到默认 `blender`，改用本机 Blender 5.2.1 LTS CLI。源 `.blend` 未改写。候选工作台副本验证移除一张完全重复面（8000→7999），凳子 2900 面。[提取记录](blender-extraction.json)与[候选编码](runtime-assets.json)保留；候选归档 `assets/workshop/rejected-outdoor-runtime/`，不在 public/dist。完整室内原文件没有采用这项候选面修复。
4. `interior-v1/`（4 张）为首次完整室内固定机位；`development-v1/`（11 张）为初次真实键盘流程。进门镜头过近，主要看到角色与地毯。
5. `development-final/`（11 张，名称是当时阶段名）扩大镜头后功能通过，但门厅角色过于靠近画面下沿，最终未采用其镜头。`development-release/` 才是最终镜头和窗色对应的流程证据。
6. 室内窗色跟随昼/夕/夜，原始烘焙按昼夜混合；仍存在墙脚亮缝和近景纹理精度限制，非全面美术验收。模型来源不会因为本轮复用而变成新 Lux3D 生成。
7. 审计尝试读取纹理时本机 Python 没有 Pillow，未临时安装依赖；改用已有 glTF Transform/meshoptimizer 读取 GLB 元数据和纹理尺寸。

8. 首轮 `lookout-production/` 回归在入口截图时超时：`CDP timeout: Page.captureScreenshot`。控制台错误数组为空，只有出生点截图，入口和失败帧未能取得；不据此伪造游戏成功。新独立浏览器复测输出 `lookout-production-retry/` 并通过，原失败保留。

## 验证方法

- `pnpm lint`、`pnpm test`、`pnpm build`：52/52，14 文件，lint 无警告，构建保留既有大包提示。
- `scripts/check_workshop_headless.mjs`：碰撞模块只用于计算合法地面路线；从出生点开始使用实际键盘，未注入材料或完成状态。覆盖取消拾取、取消制作、防重复、三次修整、家具阻挡、进入/退出、再入和刷新；回到原室外位置有数值断言。
- `scripts/check_workshop_production.mjs`：使用相同合法路线与真实按键，根据可见 UI / localStorage 判断进度；不导入生产 store，没有 QA 遥测。刷新后的部分资源来自缓存，Performance 的 decodedBodySize 为 0 不表示文件为空；真实文件大小及 public/dist 一致性使用哈希审计。
- `scripts/check_workshop_views.mjs`：昼/夕/夜共 13 机位，包含八个既有场景、木墩、室内全貌/工作区/门厅/出口。室内固定机位用开发状态夹具放置角色和成品；不得将这些图误写成真实制作过程。
- 原有划船、成长、喂养、观景、钓鱼在生产包逐组回归。最终目录、浏览器版本、分辨率、截图数和资源一致性统一记录到 [validation.json](validation.json)，最终八组全部通过，共 80 张实图，浏览器 Edge 156.0.4314.42、1440×900；不以历史通过结果替代本轮检查。
- 所有专用 Edge 配置在项目 `.tmp/` 下建立并通过最外层 finally 清理，不触碰用户浏览器或迁移归档。未提交、推送或部署。
