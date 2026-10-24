# 中央座位与原始划桨配合收尾 · 2026-10-23

本轮完成中央落座和原桨随动的本机修复与限定验证。复核页默认使用 `center-seat-v11.glb` 与 120 Hz 独立桨轨迹；角色仍直接播放原 `paddle`。完整上船、操船、下船玩法尚未接入，正式 `public/assets/models/` 的原资产没有覆盖。

## 实际产物与保留范围

- 船：`assets/lux3d/round-01/canoe/center-seat-v11.glb`，17,372,336 B、280265 三角面。对应 `.blend` 保留制作场景。中央人物 XY 不移动，整体抬高 0.26 m；木座顶面 Z=0.145 m，替换旧中央座板并为原衣料留出空隙。没有局部挤压、缩窄或切开外船壳。
- 独立核对 270555 个保留船体面的坐标、UV 和材质分配；移除的 16497 面均位于原中央座位区域。两张 2048×2048 船贴图的实际 GLB 解码像素与原文件一致。这是内部结构替换，不是减面优化。
- 浣熊仍为原 rig-mixamo-v6：38 骨、19 动作、衣服、尾巴、网格、权重未改。`public/assets/models/raccoon.glb` SHA-256 为 `f35123a06d790a6802d20f278c4d2c23997ccf16c49dfd56923e6d8acf8a2a41`；原船为 `0adaf76fee4d01db337c7499760396fd9642159756b95551c092080fc9eb6ec9`。
- 桨直接取自原船的 `Paddle_shaft`、`Paddle_blade`，统一比例 0.5；仅改变独立道具的位置、旋转和握位。双手划水时按实际手套表面保持接触，回桨时由一只手支撑；右侧收桨将支撑握位移向柄端，避免伸出的桨柄扫过松开的上臂。没有 IK、角色骨骼覆盖或角色动画重烘焙。
- 最终轨迹 prop-track.json（本地原始记录：`prop-track.json`），865 个关键点，120 Hz，7.2 s。SHA-256：`268db90b6394087902ab1a97c541f1d21ee0c245261c94aaea7e98ead23091b1`。派生船 SHA-256：`ce0c34a2686c3344abf98be816b1bf2f45164f8eedd446340be2959ce5005d1e`。
- 来源沿用 Lux3D 船任务 4266578、既有角色和既有 Mixamo 动作。新增木座由 Blender 本地制作；本轮没有付费 API、提交、推送或部署，没有新增商业许可声明。

## 验证结果

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 全周期身体/船壳、身体/座位 | 120 Hz / 865 样本，相交样本均为 0 | geometry-dense-audit.json（本地原始记录：`geometry-dense-audit.json`） |
| 全周期桨/船壳、桨/座位、桨/头颈及受检身体 | 865 样本，相交样本均为 0 | 同上 |
| 实际蒙皮手套接触 | 支撑手缺失 0；双手握持阶段第二只手缺失 0 | 同上，独立于轨迹中的参考握点 |
| 座位支撑间隙 | 每个样本均找到臀腿下方的座板支撑射线，最近间隙约 9.98–17.77 mm | 同上；为衣料/动画留量，不是刚体接触模拟 |
| 桨插值、循环与水位 | 865 样本桨/船及座位相交 0；循环位置差 0.353 mm；左右水线下桨叶样本 107 / 79 | interpolation-audit.json（本地原始记录：`interpolation-audit.json`） |
| 源模型与原动作 | 原网格/权重、217 帧骨骼局部矩阵、保留船体面及纹理核对通过 | [scope-verification.json](scope-verification.json)、[asset-manifest.json](asset-manifest.json) |
| 无头 Edge | 155.0.4283.62，1440×900；两布局 434 原手位样本、两个真实播放循环、0 控制台异常；38 PNG | headless-validation.json（本地原始记录：`headless-validation.json`） |
| 工程检查 | lint 通过，test 6/6，build 通过，脚本语法及 diff 检查通过 | [validation-results.json](validation-results.json) |

检查范围：角色对船体/座位使用完整蒙皮表面；桨对身体允许手套以及距原手中心 9 cm 内的前臂握持区域接触，其他身体面均检查，原始接触计数也完整保留。**这些结果不等于全身绝对零接触、连续时间碰撞证明、物理划船模拟或用户最终视觉验收。** 浏览器中的源手位最大坐标误差约 0.0044 mm；支撑参考握点误差小于 0.007 mm。参考握点数值校验和实际手套表面接触检查是两项独立证据。

主 JS 1,219.80 kB / gzip 336.74 kB，既有 >500 kB 提示保留。Blender 原材质的多贴图采样器节点提示仍存在，贴图像素核对通过；没有用关闭警告代替检查。

## 浏览器截图与动作视频

[完整动作视频](review-loop.mp4)：7.2 s、30 FPS、216 帧、1440×900、459832 B。由独立无头 Edge 的真实逐帧画面编码；运行时连续播放另由两循环检查证明。

- [中央落座与尾部留空](headless-stern-close.png)
- [中央木座结构](headless-stern-structure.png)
- [右侧划水](headless-water-180.png)
- [右侧收桨，支撑手移向柄端](headless-right-197.png)
- [原布局对照](compare-baseline-190.png) / [最终布局同机位](compare-center-190.png)

已查看中央落座、左右划水、手部近景、收桨及后方结构截图。验证全程使用独立无头 Edge，没有占用主屏鼠标。

## 失败稿与复现

旧短桨及过早抬桨会擦脸、不能有效触水，已留在 `rejected-short-paddle/`。v7～v10 是座板边缘修正过程稿；固定双手约束、离散握位跳变及仅检查整数帧的方案未作为最终结果。宽度扫描为只读诊断，缩窄船体路线未采用。部分搜索诊断超时或中止，不能当作完整验证；最终判断以本页链接的同一轨迹哈希审计和浏览器结果为准。

离线生成顺序（通过 `scripts/aholo/blender_run.py` 调用 Blender）：

1. `finalize_center_bench.py`：中央木座与船导出。
2. `finish_paddle_track.py`：原桨及原动作基础轨迹，保存 `prop-track-base.json`。
3. `polish_paddle_extraction.py`、`fit_paddle_hand_surfaces.py`：柄部净空与实际手套握持。
4. `audit_canoe_stern.py --final --dense`：记录需要补细的时间点。
5. `refine_paddle_subframes.py --left-only`：左侧换手补细，保留 `prop-track-working.json`。
6. `extract_paddle_by_handle.py`：右侧柄端提桨与回位；`finalize_paddle_review.py` 清除已废弃的搜索测量字段。
7. 再执行 `audit_canoe_stern.py --final --dense`、`audit_paddle_interpolation.py`、`verify_center_bench.py`，并核对轨迹哈希。
8. 本地 Vite 5176 下运行 `node scripts/aholo/check_paddle_headless.mjs --video`；复核页为 `/scripts/aholo/paddle-review.html`。该页会校验模块版本、模型路径和轨迹哈希，避免旧缓存造成假通过。

实际模型结构及审计依据是本地文件。另核对了 [Blender 官方 BVH 实现](https://raw.githubusercontent.com/blender/blender/main/source/blender/python/mathutils/mathutils_bvhtree.cc)：`overlap` 使用三角面相交回调，并非仅用包围盒判定。
