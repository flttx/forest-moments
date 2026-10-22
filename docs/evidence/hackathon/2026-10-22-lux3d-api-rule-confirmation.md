# Aholo Hackathon · Lux3D API / Codex / MCP 使用规则确认

- 记录日期：2026-10-22
- 类型：赛事规则沟通记录（非 3D 模型生成记录、非运行时验收）
- 资料来源：参赛者在当前 ChatGPT 会话中粘贴的主办方回复英文原文
- 证据级别：**用户提供的文字转录**。目前未附官方 Discord 消息链接、发言人身份或原始截图；本文不能作为已独立核验的官方原始截图。
- 关联项目：森林拾光 / Forest Moments
- 适用赛事：Aholo Global 3D AI Hackathon

## 询问的问题（沟通背景）

参赛作品必须使用 Aholo Lux3D 参与核心 3D 内容或关键创作流程；询问能否用官方 Lux3D API，通过 Codex 或 MCP 生成核心模型，随后在 Blender 优化并集成进 Three.js 游戏，而不使用 Web Studio。

## 官方回复（用户提供原文，逐字保留）

> Yes, that workflow meets the Lux3D usage requirement. Using the official Lux3D API through Codex or MCP to generate your core 3D assets counts—you don’t need to use the Web Studio. You can refine the assets in Blender and integrate them into your Three.js game. Please clearly describe how Lux3D was used in your submission. Looking forward to seeing your forest world!

## 中文翻译

> 是的，这一工作流程符合 Lux3D 的使用要求。通过 Codex 或 MCP 调用官方 Lux3D API 生成作品的核心 3D 资产，属于有效使用，无须使用网页 Studio。你可以在 Blender 中继续优化这些资产，并将其集成到 Three.js 游戏中。请在提交材料中清楚说明 Lux3D 是如何被使用的。期待看到你的森林世界！

## 对项目的实际结论

1. **比赛工具合规路径得到文字确认**：官方 Lux3D API → Codex / MCP → 核心 3D 模型 → Blender 优化 → Three.js。
2. 不必为了满足强制工具规则专门使用 Lux3D Web Studio。
3. **最终报告必须明确说明 Lux3D 的实际用途**，不能仅罗列工具名称。
4. 此次回复不代表项目已经调用过 Lux3D，也不代表任何模型已经生成、验收、获得商业授权或通过最终赛事审核。
5. **参赛规则合规不等于商业许可**：需另外核对 API 生成内容、模型、参考图、第三方资产的权利条款。

## 后续必须补全的创作证据

每件核心 Lux3D 模型都记录：资产名称与用途、官方 API endpoint 区域与模型/操作名（不包含密钥）、任务 ID、调用时间、输入类型和必要的脱敏参数、积分消耗、原始生成文件、Blender 优化操作、优化前后截图、GLB 路径、实际网页运行截图及授权核对结果。

建议优先选择浣熊、工坊、瞭望塔、独木舟等真正进入游戏并发挥核心作用的资产，用于提交报告的完整链路证明。仅概念图或 Three.js 程序占位几何**不计作已由 Lux3D 生成**。

## 待补原始证据

- [ ] 取得并保留原始 Discord 官方回复截图，且不暴露私人信息
- [ ] 保存该回复的 Discord 消息链接、频道与显示发送者（若可获取）
- [ ] 首次 Lux3D 真实生成成功后补充任务响应、资产和迭代对比
- [ ] 提交前复核最新赛事规则，确认资格与素材授权要求

报告引用：[`docs/report/PROJECT_REPORT.md`](../../report/PROJECT_REPORT.md)；资产流程：[`docs/ASSET_PIPELINE.md`](../../ASSET_PIPELINE.md)。
