# 海岸布局与新码头（2026-10-24，本机验证完成）

用户新指令：工坊与瞭望塔分至小岛两个方向；沙滩和码头设在海岸；船转入大海，航行最远范围沿小岛设置；池塘保留钓鱼；需要重建的模型先出参考图，再用本机 AHOLO_API_KEY 调用 AHOLO API。

采用西南工坊、东北瞭望塔、东岸沙滩码头。复用已有建筑、浣熊、原划桨动作和木船，只为原平板码头占位生成一件真正木质栈桥。道路、草花与轻起伏沿用前轮成果，并随新位置重新连通。海岸航行圈须校验船体全包围、浅水/陆地与码头阻挡、外圈边界、重复靠泊与下船，池塘钓鱼仍独立回归。

## 新码头参考与生成

- 输入：[海边栈桥 v1](../../../references/waterside/forest-moments-seaside-jetty-v1.png)，由 imagegen 实际生成；单张完整三分之四视角，暖棕木板、六根支柱、开放两侧、四个短系泊柱，无海面/人物/船混入模型。
- 建模目标：约 9×2.2 m 连续水平木甲板，支柱深入浅海，侧边可上船；准确尺度、甲板高度、坐标轴与落脚面由 Blender 校准，参考图不当作精确投影。
- 官方 API 规范已核对：[OpenAPI JSON](https://labs.aholo3d.cn/api-docs/openapi.json)。使用中国区 https://api.aholo3d.cn、G1、300000 目标面、ZIP+GLB；先保存原稿，再依实际结构和浏览器预算处理，不以目标面数冒充实际面数。
- 本轮明确授权含为本任务上传该参考图与调用生成资源；不含仓库推送、ModelScope 发布或无关生成。密钥只从环境读取，台账/签名链接留在已忽略的本地 assets 目录。提交前查询当前报价，实际 task ID、价格和下载哈希随后补录。
- 参考与模型由本轮项目制作，商业/参赛使用许可仍按服务条款逐项确认，不自动声称已取得新的独立授权证明。

## 状态

参考图、单次生成、Blender 尺度/甲板校准与原稿/派生稿真实渲染、新 GLB 集成、布局与海上导航已实现并完成本机限定验证。22 项单测、lint、build 通过；8 组浏览器验证 PASS，89 张真实截图，[汇总](../../vegetation-expansion/2026-10-24/final-validation.json)。实际完成海上完整环岛、边界阻挡、反划返回、重复靠泊/下船与步行回岛，池塘钓鱼保留；静态生产版也验证上下船、钓获/鱼簿和加载失败恢复。

- 任务 **4321451**，G1，目标 300000 面，实际 **299741 三角面**；原 GLB **15438588 B**，SHA-256 `1da25469798414ba1ba7378300962773ccbdfbcce1e52f2bec1a5ebb865a3e53`。
- 原 ZIP **12619725 B**，SHA-256 `748fe7c7ce4b95d0c735c1e7afeab775cb243bc92675d459f27faf36832364a7`；原件均保存在 `assets/lux3d/coastal-jetty-v1/`。
- 生成前只读余额/报价查询返回 HTTP 500，保留失败记录后按用户明确授权仅提交必要的一笔。**实际扣费未核对**；不把历史单价写作本次账单。
- Blender 5.2.1 LTS：长轴转为 runtime X，长 9.2 m、宽 2.2 m，甲板局部 y=0，支柱深入水下；仅变换坐标，保留原拓扑/UV，未减面。审计 [model-audit.json](model-audit.json)，工作文件 `assets/lux3d/coastal-jetty-v1/review.blend`。
- [原稿标准化实渲染](jetty-raw-normalized.png) / [运行尺度实渲染](jetty-runtime.png)，均来自 Cycles，非参考插画。已查看甲板、角柱、支撑和横梁。
- 运行包 `public/assets/models/coastal-jetty.glb` **2447124 B**；Meshopt + 两张 2048² WebP（quality 92），三角面数保留。[运行清单](runtime-asset.json)、[ZIP/原件/运行文件完整性](integrity.json)。已查看浏览器码头、上船/返回/下船和边界图；[最终码头日景](../../vegetation-expansion/2026-10-24/coastal-final/day-dock.png)、[返回下船](../../vegetation-expansion/2026-10-24/coastal-production-final/03-built-landed.png)。

## 限制与后续

这是沿岸运动学航行范围，不是海洋浮力模拟；上下船为直接状态切换。局部树冠视线裁切仍有可见轮廓，整体模型资源约 95.68 MiB、JS 大包提示保留，跨设备性能和全项目最终美术未验收。实际 AHOLO 扣费仍待账单核对。本轮无提交、推送或部署。
