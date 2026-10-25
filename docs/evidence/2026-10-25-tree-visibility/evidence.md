# 树木保持可见 · 2026-10-25

用户要求靠近树木时不消失，并保留碰撞。对照本机 `F:/Projects/my-blog/src/world/scene/FoliageFade.tsx` 与 `src/world/collision/RuntimeCollisionWorld.ts`：前者也会裁剪相机附近/视线中的叶片，后者独立计算底部树干圆碰撞。本轮参考其碰撞与显示分离的结构，但遵循用户明确要求，不复制其消隐行为。

- 参考文件 SHA-256：FoliageFade `566cd04bfb6521517785f694b6a9a83a82d0669f60829b8e5d15ae4d53694700`；RuntimeCollisionWorld `7cde013d81daca252f447f0b6b9aeb0c4a0d9375bb57b55bc6a970f06f0713cf`。
- 移除 ForestKit 的整株遮挡判断、实例覆盖率缓冲与 foliageMaterial 的 discard；保留叶色差异、阴影、27/31 m LOD 迟滞和原树干碰撞。移除已废弃的消隐模块及其两项测试。
- 无新增模型/贴图/AI 参考图，无 AHOLO/Lux3D/Blender 生成，无付费调用或部署。

## 前后对比

`before/02-at-trunk.png` 与 `after/02-at-trunk.png` 是相同松树、白天、默认镜头、实际 W 行走到碰撞处的截图。时间步差异使位置相差小于 1 mm。旧版隐去 1 株树但仍阻挡；新版树冠/树干完整可见，持续按 W 700 ms 位移为 0，角色中心距离树干中心约 0.6052 m（树干半径 0.3249 m + 角色半径 0.28 m）。

`after/04-orbit-trunk.png` 如实记录剩余限制：关闭消隐后，近距离环绕可能使相机进入其他树冠，出现叶片遮满视野。没有把它算作相机避障通过；本轮没有新增树冠相机避让，可通过调角度/拉远离开。`after/05-whole-island.png` 为实际滚轮拉远后，完整岛岸和树林保持显示。

## 复现和证据

- `node scripts/check_tree_visibility.mjs`：开发服务 5176；选择可通行松树起点，实际 W 按键、持续碰撞、昼/夕/夜、右键环绕和滚轮拉远。起点/时段为显式测试夹具。默认断言所有 162 株植被有一份活动 LOD、无覆盖率属性、无丢失/重复 chunk。回放旧版时设置 `FOREST_QA_EXPECT_VISIBLE=0`，并指定独立 `FOREST_QA_OUT`。
- `scripts/check_sleep_lighting_views.mjs`：三时段七机位回归，输出到本目录 views。
- `scripts/check_expansion_production.mjs`：5178 生产包启动、W/环绕/缩放、无开发遥测，输出到 production。
- 所有浏览器使用项目 .tmp 隔离配置，finally 清理；原始 headless-validation.json 和批量截图留本地、默认忽略。汇总见 validation.json，报告选用图单独白名单。
- 本机 Edge 156.0.4314.42，1440×900；lint、82/82 单测（19 文件）、build 通过。主 JS 1335.75 kB / gzip 379.14 kB，保留已有大分块提示。单测由 84 降为 82 是移除了两项已废弃消隐测试。
