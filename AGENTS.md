# Forest Moments 项目规则

项目：E:\Projects\forest-moments（森林拾光）

## 核心约束

- 项目定位：PC 浏览器中的轻量手绘风 3D 森林生活体验。建筑少而精，优先工坊、养殖场、瞭望塔、路灯、池塘、码头与树木。
- 技术：React + TypeScript + Vite + React Three Fiber + Three.js + Zustand，纯前端、静态托管；除非必要不加服务端。
- 美术：成熟克制的温暖童话森林，针叶树主、少量阔叶，暖木、暖灰岩石、琥珀灯光、自然路径，避免塑料感和密集建筑。
- 阶段状态必须精准区分：计划 / 占位 / 实现待验证 / 已验证；切勿把灰盒场景、占位动作说成完整玩法。
- 重要用户体验：浣熊动作流畅、尾巴自然；钓鱼/种树/划船拥有真实可感知的交互闭环，而非提示文字模拟。
- 2026-10-24 用户修订：资源体积为可调整的参考指标，不以固定 MB 数阻塞下一阶段；优先画面、动作与实际加载体验，优化依据真实测量，不为数字强制减面或降贴图。

## 每轮开发操作

1. 先读 PROGRESS.md、docs/PRD.md、docs/report/PROJECT_REPORT.md；检查实际文件和 Git 状态。
2. 实现最小范围改动，保留当前成果；必要时新增测试。涉及资产时，先核对使用权和模型预算。
3. 执行 pnpm lint、pnpm test、pnpm build（环境阻塞则清楚标注）；可视化结果需要实机浏览器截图审查。
4. **同时更新 PROGRESS.md 和 docs/report/PROJECT_REPORT.md**：修订日期、功能状态、技术方案、Lux3D/Blender 产物证据、测试结果、尚存问题，写入修订记录。
5. 新增视觉效果时，把来源、生成过程、初版与优化版截图及文件位置记录到 docs/evidence/，不得伪造截图或把计划写成成果。
6. 参赛 PDF/PPT 从活文档内容导出，导出后核验截图与排版，禁止维护事实互相冲突的另一份报告。

## Skill 入口

- .agents/skills/forest-visual-qa/SKILL.md：视觉复核与截图对比
- .agents/skills/forest-asset-pipeline/SKILL.md：Lux3D、Blender、GLB 资产流程
- .agents/skills/living-project-report/SKILL.md：每轮持续更新报告
- .agents/skills/ms-hub/SKILL.md 与 ms-studio-deploy：官方魔搭流程（若实际安装到此目录）

## 测试临时目录（2026-10-24）

- 浏览器测试统一使用 `scripts/browser-session.mjs` 的 `createHeadlessBrowser`，临时配置、缓存和浏览器进程 TEMP/TMP 位于项目 `.tmp/`；禁止直接调用系统 `tmpdir()` 创建测试配置。
- 每个测试在最外层 `finally` 中 `await cleanup()`，报告写入失败也必须执行清理。辅助测试使用 `createProjectTempDirectory`，并在结束后删除自己的临时目录。
- `.tmp/legacy-browser-profiles/` 是从 C 盘迁回的历史目录，保留备查，不用于新测试。强制结束进程或断电仍可能在项目 `.tmp/` 留下目录。

## 国际站部署

目标必须是 https://www.modelscope.ai，绝不默默回退到 modelscope.cn。
只发布编译后的 dist/ 静态产物，不直接公开完整源码、Blender 工作文件、密钥。
没有用户明确授权，不创建远程空间、不上传文件、不推送、不部署、不调用付费资源。Token 不进日志、仓库或截图。
