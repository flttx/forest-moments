# 森林拾光 · Forest Moments

一个独立的、温暖童话风格的 3D 微型森林生活世界。项目专为浏览器 PC 端创建。

## 当前原型

已有程序几何的树林、工坊、养殖场、池塘、瞭望塔和码头；灰盒浣熊可 WASD/方向键行走、Shift 奔跑，靠近地标后按 F 或点界面按钮互动。树苗种植状态保存到浏览器 localStorage。尚无完整钓鱼、划船、动物、工坊制作或骨骼动画。

## 本地命令（Node.js 24+ / pnpm）

```powershell
cd E:\Projects\forest-moments
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm preview
```

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

React 19 + TypeScript 6 + Vite 8 + React Three Fiber / Three.js + Zustand。日后逐步引入经过授权的 Lux3D / Blender 模型，逐项替换占位几何并做实机视觉 QA。
