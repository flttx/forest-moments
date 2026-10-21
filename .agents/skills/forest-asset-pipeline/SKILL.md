---
name: forest-asset-pipeline
description: Forest Moments 项目通过 Lux3D/Tripo/Blender 制作动物、浣熊、树木、木屋、船、工具以及动画并输出浏览器 GLB 时使用。
---

# Forest Asset Pipeline

1. 读取 docs/ASSET_PIPELINE.md 与 docs/ART_DIRECTION.md，确定风格、预算和工具归属。
2. 在资产清单记录模型来源、生成账号和积分、商业授权依据；未明确授权时暂停商用声称。
3. 角色要检查骨骼层级、蒙皮、走/跑/坐/蹲/钓鱼/划船、尾巴独立关节与自然阻尼，优先低复杂度浣熊而不是难调优的高复杂模型。
4. Blender 验证法线、UV、比例、原点、轴、碰撞和绑定；生成 GLB 后检查三角形数、贴图尺寸和实际包大小；重复植被在运行时优先实例化。
5. 对视觉资产生成初版与优化后同机位截图、边界错误说明、真实浏览器加载与内存/帧率验证。
6. 最后同步 PROGRESS.md、docs/report/PROJECT_REPORT.md，并提供未完成项与下一阶段资产计划。
