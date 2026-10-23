# 森林拾光 · Forest Moments

一个独立的、温暖童话风格的 3D 微型森林生活世界。项目专为浏览器 PC 端创建。

## 当前原型

已接入浣熊模型与原骨骼动作、工坊、木塔和木船；支持 WASD/方向键行走、Shift 奔跑、F 互动、树苗存档、池塘钓鱼与鱼簿、上船划行及返回码头。海天、岸线与地表已完成首轮渲染优化。树林与牧场仍含程序占位，树苗成长、动物养殖、工坊制作和登塔尚未实现。

my-blog 树木、草花和路灯迁移及小岛扩建目前仅有[计划](docs/SCENE_UPGRADE_PLAN.md)，尚未实施。当前限制与实际验证见 [PROGRESS.md](PROGRESS.md)。

## 本地命令（Node.js 24+ / pnpm）

```powershell
cd E:\Projects\forest-moments
git lfs install
git lfs pull
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm preview
```

运行时模型位于 `public/assets/models/`，GLB 通过 Git LFS 保存；首次克隆必须拉取 LFS 文件，否则模型无法加载。当前运行时模型与轨迹约 92.22 MiB，尚未完成下载体积优化。

仓库包含运行代码、运行时资源、验证/建模脚本和精选证据。`assets/` 下原始下载包、Blender 工作文件及模型候选仅在本地保存；离线建模脚本需要这些源文件及 Blender，不能只凭仓库重做全部历史模型。运行项目和构建不依赖这些本地源文件。批量截图不随提交发布，证据保留范围见 [证据说明](docs/evidence/README.md)。

## 开发约定

- AGENTS.md：必须遵循的代码、美术与文档纪律。
- PROGRESS.md：当前实现进度和待完成项。
- docs/PRD.md：范围、需求与验收标准。
- docs/ART_DIRECTION.md：成熟手绘童话森林美术基线。
- docs/ASSET_PIPELINE.md：Lux3D/Blender/GLB 模型生产和授权。
- docs/report/PROJECT_REPORT.md：**参赛报告书长期维护主稿**。
- docs/REPORT_WORKFLOW.md：每轮开发如何同步报告和真实截图。
- docs/DEPLOY_MODELSCOPE_AI.md：只部署到国际站 https://www.modelscope.ai 的 Static 模式。
- docs/SKILLS.md：官方部署 Skill 和项目自定义 Skill 列表。

## 安全与部署

部署目标：国际站 ModelScope.ai，正式操作需要本人 Token 和授权。本地的任何源码、图像参考、报告草稿及密钥都不应直接发布。发布仅同步构建后的 dist 文件。当前项目没有上线。

## 核心技术

React 19 + TypeScript 6 + Vite 8 + React Three Fiber / Three.js + Zustand。已接入部分 Lux3D / Blender 资产；后续逐项替换占位并复核使用权、性能和实机视觉表现。
