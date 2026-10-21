# 项目 Skills 清单与使用场景

## 官方 ModelScope Skills
来源：https://github.com/modelscope/modelscope-skills（Apache-2.0；已引入则放置在 .agents/skills）。
- ms-hub：魔搭模型/数据集/仓库/创空间速查，必要时检查登录和国际站元数据。
- ms-studio-deploy：静态 Studio 创建、同步预构建文件、部署、查询状态和日志、问题定位。
要求：**仅 https://www.modelscope.ai** + 国际站 Token；创建、公开、部署和任何付费操作前需用户明确授权。官方默认可能是 modelscope.cn，此项项目规则覆盖默认值。
官网源文档并不代表 Token 已配好或已经远程部署。

## 项目专属 Skills（本地）
- forest-visual-qa：三维森林昼/夕/夜视觉 QA，镜头与截图证据要求。
- forest-asset-pipeline：Lux3D、Blender、GLB、骨骼与授权、性能检查。
- living-project-report：开发每轮自动更新 PRD/进度/参赛报告正文，并归档可验证的截图与差异。

## 生效规则
Codex 从当前仓库的 .agents/skills 读取，重开会话或刷新 Skill 索引后通常可发现；不同客户端的实际发现方式需要根据其文档核实。
只把 Skill 文件放在目录，不等于它已经运行、发布或验证了任何效果。不要安装大量和目标无关的 Skills 来增加提示负担。

官方 Skill 源码快照：GitHub modelscope/modelscope-skills commit c45e01e（2026-10-21 本地克隆）。部署操作前应复核其最近版本和站点选择。
