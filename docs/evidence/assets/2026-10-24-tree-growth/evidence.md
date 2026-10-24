# 四阶段树苗与真实成长证据 · 2026-10-24

状态：本机限定验证完成。主稿为 [PROJECT_REPORT 5.28](../../../report/PROJECT_REPORT.md)，其中直接嵌入参考图、失败修整、材质对比及四阶段实机，以下保存可追溯数据。

## 设计调整与资产来源

用户先要求不同生长阶段的漂亮模型，随后追加第一阶段应更小且没有分叉，因此保留原分叉树苗为第二阶段，新增 22 cm 单茎小苗。四阶段使用同类裂叶、暖木和手绘色彩，以不同分枝/冠幅表现成长。参考图先由内置 imagegen 生成并查看，再通过本机 `AHOLO_API_KEY` 提交 AHOLO G1；完整输入见 [reference-prompts.json](reference-prompts.json)、[sprout-prompt.json](sprout-prompt.json)。没有用程序几何替代整株模型。

| 阶段 | 任务 | 高度 | 运行三角面 | GLB 字节 |
| --- | --- | --- | --- | --- |
| 初生小苗 | 4323002 | 0.22 m | 9758 | 182300 |
| 分叉树苗 | 4322894 | 0.55 m | 14194 | 318368 |
| 幼树 | 4322899 | 1.5 m | 39715 | 722564 |
| 成树 | 4322904 | 3 m | 77992 | 1489516 |

每项只创建一次；请求面数分别为 10000/15000/40000/80000，单图 G1，关闭 AI 自动尺寸，输出 ZIP+GLB。成功状态为 3。原始下载包、签名链接、工作 blend 位于被 Git 忽略的 `assets/lux3d/growth-{stage}-v1/`；公开证据清单只含任务、允许的参数、文件大小和 SHA-256，不复制签名 URL 或密钥。响应未提供实际扣费，费用待核对；使用源为用户授权生成，没有新增商业许可证核验，不作商用声明。

官方参数来源：[Lux3D API 文档](https://lux3d.aholo3d.cn/lux3d/doc?lang=zh_CN#api-reference)、[本次实际获取的 OpenAPI](https://labs.aholo3d.cn/api-docs/openapi.json)。任务执行脚本为 `scripts/aholo/submit_growth.mjs`，再次调用会涉及外部资源，日常复核仅读取已下载产物。

## Blender 与运行包

Blender 5.2.1 LTS：烘焙世界变换，根部底部 2% 顶点求中心、底面归零、统一高度，成树绕竖轴转 90°。保留原网格/UV；小苗顶芽原先有约 8 mm 间断，添加 44 面短细茎连接，整体拓扑因此有变化，不宣称封闭流形。首次断口图为 `sprout-first-front/back.png`，成树原方向为 `mature-first-front.png`。

初次实机叶片反光偏强，原因是生成的金属/粗糙度贴图覆盖了常量。最终移除相应连接与运行贴图，统一金属度 0、粗糙度 0.85；保留颜色贴图。`*-glossy-front.png` 是修正前离线渲染，`*-runtime-front/back.png` 是最终渲染；各单体渲染分别取景以便检查，不能据此比较物理大小。Cycles 24 samples、1000×1000；原图及逐件审计 `*-audit.json` 保留。

通过 `scripts/compress_growth.cjs` 进行 Meshopt 编码和 1024 WebP（质量 92）转换，不减主体面数。运行包总 2712748 B，约 2.59 MiB；单件三角面/贴图/哈希见 [runtime-assets.json](runtime-assets.json)。所有四件一次预载，仅当前阶段显示。最终 public/dist 一致，原八 GLB、植被和只读 my-blog 源码未变，见 [manifest.json](manifest.json)。模型/轨迹/植被总 103039613 B，约 98.27 MiB，下载预算尚未达标。

## 玩法和边界

- 一个种植点 `(0,8)`；靠近 1.8 m 内按 F，栽种 1.6 秒，Esc/失焦可取消。完成后自动观察，F 或方向键退出。
- 独立模型在种下后 0/45/120/240 秒出现，时间计入离线，保存已达到阶段防止回拨倒退；这是离散阶段替换，不是连续枝条模拟。
- `tree:v2` 保存种植时间/阶段，原 `seedling:v1=true` 迁为第二阶段；坏档忽略，保存被拒时明确告知本次会话可继续。
- 随阶段扩大树干碰撞；成树不占用相邻主路通行点，阶段改变时推出停留在树干中的角色。
- 复用原角色通用 interact 动作，不修改角色、衣服、尾巴或原动画；未制作挖土/浇水专用动作，也没有浇水、采收、多地块或多人存档。
- 新树轻微顶端风动，遵循减少动态效果设置；本轮确认该媒体设置生效，未作连续风动的逐帧测量。

## 实际验证

环境：Windows、隔离无头 Edge 156.0.4314.42、RTX 5060 Ti、1440×900；开发端口 5176、生产预览 5178。可见画面已检查昼/夕/夜全场景接触表，以及小苗近景、成树、关键回归帧。树林、建筑布局与海岸保持此前状态；牧场仍是灰盒，不当作最终美术。

`pnpm lint` 无警告；`pnpm test` 10 文件 32 项通过；`pnpm build` 通过。主 JS 1273.76 kB / gzip 358.18 kB，既有 >500 kB 拆包提示保留。

| 检查 | 方法/范围 | 实图数 | 结果 |
| --- | --- | --- | --- |
| 开发真实成长（本地原始记录：`browser-development/headless-validation.json`） | 真键盘、真实四分钟等待；取消、栽种、观察、成长、成树碰撞、刷新；另加迁移/坏档/离线/存储失败夹具 | 10 | PASS，0 控制台异常 |
| 最终场景视图（本地原始记录：`browser-views-final/headless-validation.json`） | 四阶段×昼夕夜；三时段默认/鸟瞰/池塘/工坊/塔/牧场/角色；减少动态设置 | 34 | PASS，阶段采用显式存档夹具 |
| 最终生产成长（本地原始记录：`browser-production-final/headless-validation.json`） | 真实栽种与等待 45 秒、刷新、离线成树夹具、观察退出；无开发遥测 | 4 | PASS，0 控制台异常 |
| 生产划船（本地原始记录：`rowing-production/headless-validation.json`） | 实际键盘上船/航行/靠泊下船，13 模型及轨迹资源加载，无开发遥测 | 3 | PASS |
| 生产钓鱼（本地原始记录：`../../vegetation-expansion/2026-10-24/regression-tree-growth-fishing_production/headless-validation.json`） | 真键盘/可见张力控件、钓获、鱼簿刷新 | 6 | PASS |
| 小苗加载故障恢复（本地原始记录：`../../vegetation-expansion/2026-10-24/tree-growth-recovery/headless-validation.json`） | 主动中断 tree-sprout.glb，显示错误与重试，恢复渲染 | 2 | PASS，注入错误如实保留 |

六组通过记录合计 59 张实图，不含接触表、Blender 渲染、早期试稿和失败截图。四分钟流程在最后的材质修订前完成，玩法代码一致；最终材质由后续 34 张视图与生产流程覆盖。旧 5.27 的 30 秒性能数字只保留历史，本轮未重测，也没有跨设备/公网性能承诺。

首轮生产验证固定时长移动在重载后没有走到种植角，读取不存在的阶段控件导致失败：原始失败记录（本地原始记录：`browser-production/headless-validation.json`）。脚本改用可见种植按钮或阶段文字判断位置，再靠近少许；游戏速度/到达半径未为测试修改。最终独立目录通过，失败图未覆盖。最终三时段和各尺寸仍可见叶片多边形轮廓，第一阶段远看很小，使用观察镜头查看叶形。

## 复核入口

已有本地服务时可执行：

```powershell
pnpm lint
pnpm test
pnpm build
node scripts/check_growth_headless.mjs
$env:FOREST_RENDER_STAGE='browser-views-final'
node scripts/check_growth_views.mjs
$env:FOREST_QA_OUT='docs/evidence/assets/2026-10-24-tree-growth/browser-production-final'
node scripts/check_growth_production.mjs
python scripts/audit_growth.py
```

检查脚本只操作各自临时 Edge 配置，成长完整流程需要约四分钟。审计依赖本机忽略目录中的原始 AHOLO 下载产物；新克隆没有这些文件时须说明缺失，不能伪造来源。`manifest.json` 记录原始及运行包 SHA，`validation.json` 记录截图哈希/尺寸和文档链接检查。未提交、推送、部署或导出 PDF/PPT。
