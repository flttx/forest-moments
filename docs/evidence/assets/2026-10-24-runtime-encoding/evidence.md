# 原面数运行文件编码与原桨拆出 · 2026-10-24

## 目的与来源

牧场完成后，运行时模型、桨轨迹与植被共 103952597 B（99.14 MiB），超出初版完整下载 25 MiB 目标。检查发现四个大模型仍是未编码的几何缓冲和 PNG；此外运行时为提取两个 `Paddle_*` 网格，额外下载了 17562100 B 的完整旧船。本轮先去除这项重复下载，再做不改变表面与动作的编码。

复用当前已验收的 Lux3D → Blender 产物：浣熊、工坊、瞭望塔、中央木座船及原桨。来源和生成任务沿用原报告 5.1–5.29，本轮没有新参考插画、重新建模、Blender 编辑或 AHOLO/Tripo 请求；无新增费用或授权声明。当前工作前的真实场景截图 `before/` 为视觉基准，不能把旧参考图当作压缩成果。

## 编码与数值门禁

`scripts/encode_runtime.cjs` 使用本机既有 glTF Transform 4.5.0、Meshoptimizer 和 Sharp。原运行 GLB 只读副本在 `assets/runtime-encoding/before/`，候选在 `candidate/`，这些建模工作文件不进 dist。构建与运行不依赖 my-blog；离线编码脚本依赖本机 my-blog 的工具依赖和本地源件。

- 仅加 Meshopt 无损缓冲编码，**不运行 quantize、simplify、meshopt transform，不减面、不改顶点顺序、不降贴图分辨率**。扩展的 `QUANTIZE` 模式名称表示不用有损过滤器；实际没有执行量化步骤，属性和动画缓冲解码后的数值哈希逐项相同。
- PNG 转 WebP lossless。严格比较全部解码 RGBA（含全透明像素的 RGB）；若任一通道不相同则保留原 PNG，不以“不可见”忽略差异。最终采用版本通过全部 RGBA 比较。
- 核对每个 primitive 的位置/法线/UV/颜色/蒙皮属性、形态目标，保持数值/类型/normalized 标记；三角形索引只允许同一三角形的循环置换，不允许翻面、增减面或换顶点。
- 核对节点层级、局部与世界矩阵、蒙皮关节与逆绑定矩阵、19 个浣熊动作的轨道/时间/数值/插值；材质参数、纹理绑定、UV 集及采样器不变。
- 首个候选被严格比较拒绝：NodeIO 会省略接近单位变换的极小分量。`serialization-v1-failure.json` 与本地候选保留；最终 GLB 写入后按节点名称恢复原始 JSON 变换字段，再做全量核对，没有放宽容差。
- 从旧船只保留两个原桨网格与必要祖先节点，去掉其余未使用的船体、材质和贴图；桨的几何、材质、层级世界变换及原随动轨迹不变。独立 `paddle.glb` 为 9536 B。原完整旧船已移出 public 并完整归档；离线 paddle-review 改为读取归档，复核页补 Meshopt 解码器。

`encoding.json` 记录每件前后字节、源/产物哈希、RGBA 哈希、面数和动作；运行 `node scripts/encode_runtime.cjs --verify` 可只核对候选，不重新编码。历史阶段审计脚本保留旧模型基线，本轮当前运行文件以新的 encoding/validation 记录为准。

## 结果与限制

五份输入共 95899836 B，新四模型与独立桨共 46286272 B；整个模型/轨迹/植被目录降至 **54339033 B（51.82 MiB）**，减少 **49613564 B（47.31 MiB，约 47.73%）**。其中旧船的整个运行时副本被独立原桨替代，场景仍使用原中央木座船。

这是下载与分发体积优化，不是减少场景三角形数量；没有证明 GPU 帧耗时或呈现 FPS 提升。仍高于完整下载 25 MiB 与首屏 15 MiB 目标，JS 大包问题、跨设备性能与公网冷加载仍待处理。不通过降低模型面数或贴图分辨率达到指标。

静态 lint、40 单测（12 文件）、build 已通过。最终七组串行浏览器检查通过，共 48 张 1440×900 实图：`after` 三时段六机位 18、`../../rowing-polish/2026-10-24/runtime-encoding` 动作/水痕 11、`rowing-production` 3、`growth-production` 4、`farm-production` 4、植被证据中的 `regression-runtime-encoding-fishing_production` 6、`paddle-recovery` 2；另有 `before` 修改前基准 6 张。原桨错误注入的预期报错独立记录，恢复后没有意外错误。独立 Edge 配置与缓存只写项目 `.tmp/` 并在最外层 finally 清理。

首次牧场生产回归失败记录在 `farm-production-blocked/`：添料后让开 450 ms，角色仍停在鸡的路径，鸡按正常防穿行逻辑等待，50 秒内不能完成进食。保留当时截图与 FAIL JSON，自动测试改为真实按键让开 1200 ms 后喂食/取消/刷新通过；没有改动物路径、等待或完成判定。旧失败截图若留在成功目录中不计入成功报告截图列表。

`scripts/audit_runtime_encoding.py` 核对五个原始归档与上一阶段哈希、四编码模型及独立桨的候选/public/dist 哈希、其余 10 个 GLB 未改变、生产 16 个模型/轨迹实际请求大小、全部运行资源 dist 一致、截图文件头/尺寸和文档链接。当前完整结果在 [validation.json](validation.json)。生产网络模型/轨迹为 53159395 B；加植被得到 54339033 B。旧 `/assets/models/canoe.glb` 不再请求或分发，原件保留在工作归档。

未提交、推送、部署或导出 PDF/PPT。
