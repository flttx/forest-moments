# IE-09 海风松：古松 Blender 派生与潮汐岛替换（2026-11-02）

> 同日二次修订（「还差的地方」）：叶色冷化、两种形态、迎风侧秃枝与风剪面，见文末“二次修订”。下文前半为首版记录，产物数据以二次修订为准。

状态：**已实现，本机限定静音验证通过**；最终美术仍待用户体验确认。

## 来源与输入

- 单体参考：[IE-09 海风松](../../references/island-expansion/ie-09-windswept-pine-v1.png)（AI 参考插画，非模型）。整岛参考：[潮汐岛概念](../../references/island-expansion/tide-island-concept-v1.png)，松林倒向西侧码头，树干细长、树冠平展。
- 源模型：`public/assets/island-trees/old-pine.glb`，AHOLO Lux3D 古松任务 4461967，SHA-256 `174799…1c05`，单网格、单材质，119,684 三角形，高 8 m。
- 上一轮（2026-11-01）潮汐岛的海风松只是替身：老松在运行时缩放、倾斜、压扁（`lean`/`squash`）。这不符合参考文档“不能只把整棵树绕中心转倒”的要求，本轮已替换。

## 制作

脚本：[scripts/derive_windswept_pine.py](../../../scripts/derive_windswept_pine.py)。

复现：`python scripts/aholo/blender_run.py scripts/derive_windswept_pine.py --blender 'D:/Program Files/Blender Foundation/Blender 5.2/blender.exe'`。环境为 Blender 5.2.1 LTS，无付费调用。

整个变形是连续的逐顶点映射：

1. 根盘落地，基点留在原点。树干和根盘收细到 0.7 倍，枝条长度不变。
2. 树干沿下风方向连续弯曲，弯曲角从根部按 (s/H)^1.5 增大，到顶端为 0.92 rad。树干附近的顶点跟着弯曲转动，外圈叶团只平移，保持水平。
3. 根部以上纵向压到 0.8 倍。迎风侧枝条缩短到 0.38 倍，背风侧伸长到 1.15 倍，并按枝长略微下垂。
4. 自定义法线用映射的雅可比逆转置变换。面数、顶点数、UV 和材质都不变（脚本内有断言）。
5. 最后把背风方向转到 glTF +Z，运行时由 yaw 决定风向。

产物：

- 运行时：`public/assets/island-trees/windswept-pine.glb`，6,182,644 字节，SHA-256 `34a13385…9739`。
- 本地候选：`assets/blender/windswept-pine/`，含 `.blend`，按 `.gitignore` 不入库。
- 数据：高 5.83 m，背风伸展 4.94 m，迎风 1.32 m，根盘半径 1.74 m；119,684 三角形和 131,522 顶点，均与源模型一致；未减面。详见 [asset-validation.json](asset-validation.json)。
- 模板：`ie-windswept-pine` 已写入 `src/world/island-tree-templates.json`，内容见 [template.json](template.json)。
  - 碰撞取 0.25–1 m 高度内的最大半径 1.437 m（含根盘）。
  - 树冠球体只用于让相机避开叶团，半径取平均半宽 3.13 m，不取背风伸展长度。

## 迭代与取舍

| 版本 | 问题 | 处理 |
|---|---|---|
| v1：纵向 0.56、顶部压平 0.25 | 树干粗短；顶部叶团挤叠成暗斑 | 纵向改为 0.74，顶部压平减到 0.12 |
| v2 | 轴心附近的顶层叶团跟着弯曲角转成接近竖直，仍有暗斑 | 树冠顶段只平移不转动 |
| v3：首次实机 | 倾斜方向与北岸、总览两个机位的视线几乎重合，看上去仍是直立的树；根盘和树干比概念图粗壮 | 运行时风向 yaw 从 -0.55 改为 -1.65，倒向西侧码头；树干和根盘收细到 0.7 倍 |
| v4 | 收细的过渡区落在树干表面，中段鼓包 | 过渡半径外推到 1.0–1.9 m（采用版） |

工作室渲染（采用版）：

- [侧视](windswept-side.png)、[背视](windswept-back.png)、[正视](windswept-front.png)、[斜视](windswept-quarter.png)
- [源古松侧视](source-side.png)

中段的结节是源模型自带的枝杈，予以保留。

## 运行时接入

- `tidePlants` 6 株改用 `ie-windswept-pine`，位置不变（因此依赖它的岸岩和漂木布局也不变）。缩放为 0.58–0.72，实机高约 3.4–4.2 m。
- 删除只为替身服务的 `VegetationInstance.lean/squash`，以及 `IslandTrees` 中对应的非等比矩阵。
- `canopyMap`、树冠球体和主岛树冠表都补上了新树种条目。

## 截图

- 对比基准（上一轮替身）：[潮汐总览](../2026-11-01-island-refine/after/tide-overview.png)、[北缘松林](../2026-11-01-island-refine/after/tide-north-pines.png)。
- 采用版：`after/` 下 6 个机位 × 昼、昏、夜三档光照，共 18 张，静音 Edge，1440×900。
  - 重点看：[昼·总览](after/day-tideOverview.png)、[昼·北岸](after/day-tideNorthShore.png)、[昼·码头](after/day-tideBerth.png)、[夜·北岸](after/night-tideNorthShore.png)。
  - 采集脚本的潮汐池材质、碰撞、面积和第四泊位检查均为 PASS。

## 验证

- `tsc` 通过；`pnpm lint` 退出码 0；`pnpm test` 55 文件 251/251 通过。
  - `tideDetails` 改为检查新树种。
  - 原有潮汐环路、观察支路双向通行及 ±0.5 m 路肩检查仍通过。
- `pnpm build` 通过：JS 1,923.53 kB / gzip 591.81 kB。
- `scripts/check_tide_travel.mjs` 真实键鼠往返 8 项全部 PASS，见 [roundtrip/report.json](roundtrip/report.json)。

## 首版尚存问题（已在二次修订中处理）

- 叶团沿用古松的贴图和形态，比参考插画更概括；运行时叶色偏黄绿（受季节着色影响）。
- 6 株都来自同一个派生模型，只靠缩放和 ±0.35 rad 的 yaw 做变化，暂时没有第二种树龄形态。
- 迎风侧枝条只是缩短，没有像参考图那样做出枯枝或被风剪平的断面。

## 二次修订（同日）

脚本仍是 [derive_windswept_pine.py](../../../scripts/derive_windswept_pine.py)，一次运行输出两种形态，两者共用一张调色后的贴图。

### 叶色

- 判定叶片像素的规则和运行时叶片着色器一致（绿通道高于红通道），只调叶片，树皮不动。
- 叶片按 (0.70, 0.90, 1.04) 偏冷：叶像素平均 sRGB 从 (0.411, 0.442, 0.234) 变为 (0.308, 0.405, 0.240)，接近 IE-09 的蓝绿针叶。
- 贴图仍以 WebP 打包，质量 90。
  - 首次重打包时误用了 PNG，单个文件涨到 12.4 MB；改回 WebP 后为 6.17 MB，与源模型相当。

### 迎风侧秃枝与风剪面

- 按贴图颜色把叶片顶点连成 11,963 簇针叶。
- 迎风侧的针叶簇按偏离程度向各自中心收缩，最多收缩 62% / 75%，枝条长度不变。这样叶团变稀，露出枝梢，形成秃枝。
  - 收缩是逐簇的均匀缩放，法线方向不变。
- 迎风侧冠顶压到一个从轴顶向外下倾的斜面下，形成风剪面。

### 两种形态

| 形态 | 树干粗细 | 纵向压缩 | 树顶弯曲角 | 迎风 / 背风枝长 | 秃枝收缩 | 镜像 | 高 | 背风 / 迎风伸展 | 碰撞半径 | 字节 / SHA-256 |
|---|---|---|---|---|---|---|---|---|---|---|
| A `windswept-pine` | 0.70 | 0.80 | 0.92 rad | 0.45 / 1.15 | 0.62 | 否 | 5.83 m | 4.94 / 1.55 m | 1.437 m | 6,174,684 / `4bf16a40…` |
| B `windswept-pine-b` | 0.56 | 0.72 | 1.12 rad | 0.36 / 1.20 | 0.75 | 是 | 5.12 m | 5.18 / 1.19 m | 1.150 m | 6,174,620 / `635393fd…` |

- B 版的叶团左右镜像，避免两种形态的叶团位置雷同。
  - 镜像会反转三角面的绕序，首次渲染整棵树发黑。脚本改为翻转绕序，并按“面＋顶点”重新对应自定义法线。
  - B 版背风伸展由 1.28 降到 1.20，避免冠顶叶团被拉成木板状。
- 两种形态的面数（119,684）、顶点（131,522）、UV 和材质都与源模型一致，未减面，无付费调用。数据见 [asset-validation.json](asset-validation.json)。
- 工作室渲染：
  - A：[侧](windswept-side.png) [背](windswept-back.png) [正](windswept-front.png) [斜](windswept-quarter.png)
  - B：[侧](windswept-b-side.png) [背](windswept-b-back.png) [正](windswept-b-front.png) [斜](windswept-b-quarter.png)

### 运行时

- 6 个松位不变，A 与 B 按序号交替，各 3 株。
  - 最初按随机值分配，结果全是 B；新增的单测要求两种形态都出现，暴露了这个问题，已改正。
- B 版缩放 0.56–0.72。模板、树冠球、`canopyMap` 和 `IslandTrees` 都已补上 B 版。

### 截图与验证

- `refined/` 下 6 个机位 × 昼、昏、夜三档，共 18 张，静音 Edge，1440×900。
  - 重点看：[码头](refined/day-tideBerth.png)、[北岸近景](refined/day-tideNorthShore.png)、[总览](refined/day-tideOverview.png)。
  - 首版（`after/`）的叶色偏黄绿；修订后转为冷绿。北岸近景能看到迎风侧稀疏的秃枝，码头视角能分出粗、细两种形态。
- tsc 通过；lint 退出码 0；单测 55 文件 251/251 通过（`tideDetails` 新增“两种形态并存”断言）。
- build 通过：JS 1,923.95 kB / gzip 591.91 kB。
- 潮汐真实键鼠往返 8 项 PASS。

## 尚存问题

- 叶团的几何形态仍是古松的分层叶片，比参考插画概括；本轮只改了颜色和疏密，没有重塑针叶。
- 秃枝是“叶团稀疏、露出枝梢”的效果，不是单独建模的枯死断枝，也没有灰白色的枯木质感。
- 两种形态都派生自同一棵古松，枝序相同，B 版靠镜像和参数加以区分。
