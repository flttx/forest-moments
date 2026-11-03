# 群岛整合与美术打磨：发现记录

配套计划：[ARCHIPELAGO_POLISH_PLAN.md](ARCHIPELAGO_POLISH_PLAN.md)

## 2026-11-03 现状侦察

### 群岛实景（静音 Edge 1440×900，`archipelago`、`tideArchipelago` 机位，提交 b49d717）

- 三座小岛都是光滑的椭圆或卵形，外缘没有岬角或小湾；路线是菱形、六边形折线，俯视像几何图案。
- 岛间是大片均匀深蓝海面，没有浅滩、礁石或任何航线标记；主岛与小岛之间看不出关联。
- 主岛有宽沙滩、建筑和路灯；小岛只有树和岩岸，没有沙岸、木构或灯，夜里完全没有光点。
- 潮汐岛的浅色岩台与其他两岛的绿色岛面差异很大。

### 代码结构

- 岛形：`mistRadius`、`autumnRadius`、`tideRadius` 都是椭圆加 2–3 个低阶谐波；高度由半径 smoothstep 得出。
  - 每个函数在 TS 与 GLSL（`mistGLSL` 等）各有一份。
  - 海面浅水与泡沫在 `Atmosphere.tsx` 使用同一组 GLSL，改岛形必须两边同步。
- 路线：`mistLoop`、`autumnLoop`、`tideLoop` 是直线段折线，`*PathDistance` 按线段算距离。
- 小岛玩法：`islandTravel.ts` 的 `TravelBook` 只有到访与各岛一个发现，即 foundPine、foundVista、foundPools。
- 可复用的玩法系统：
  - 背包 `inventory.ts`：现有 8 种物品，未知 id 解码时丢弃，便于扩展；
  - 采集 `forage.ts`：采集点由主岛 `vegetationPositions` 中的特定树种推导，`onSand` 只认主岛，小岛目前没有采集点；
  - 手账 `journal.ts`：34 种任务，按页抽取；
  - 工坊配方 `recipes.ts`：table、birdhouse、rodRack、signpost；
  - 拍照题材 `photoSubjects.ts`：11 种；
  - 鱼簿 `fishSpecies.ts`：8 种，钓点分 pond 和 sea。
- 邻岛基线测试：
  - `tideCoast.test.ts` 冻结 10-30 的岸岩快照；
  - `autumnTravel.test.ts` 冻结主岛与西林以外的植被；
  - `autumnUnderstory.test.ts` 引用秋岚岸岩报告；
  - `islandTravel` 与 `autumnTravel` 检查面积比例。
  - 重塑岛形会触发这些测试，需要按新布局更新基线并记录。
- AHOLO：`scripts/aholo/submit_island_asset.mjs` 加 `run.ps1` 注入 `AHOLO_API_KEY`；赤杨参考采用 `ie-08-alder-v2.png`，v1 叶形错误，不能用。

### 规划文件位置

- Windows 文件名不区分大小写，根目录 `progress.md` 就是 `PROGRESS.md`，不能另建；规划文件改放 `docs/`。

## 2026-11-03 阶段 1

- 海面浅水和泡沫可以在 GLSL 里用内联常量生成的距离场扩展，不需要 uniform 数组；礁群和海台都按这种方式实现，与 TS 版布局同源。
- `isNavigableSea` 是船体唯一的通行判定（`BoatWaterFeedback` 的尾流也用它）。礁石和浮标加进去后，船体碰撞、尾流和停靠检查自动跟随。
- 三个邻岛的码头都在西侧，面朝主岛，航道集中在主岛东侧的海峡里；礁群放在海台外缘，不会干扰航行。
- 实机采集的首次加载在 Vite 重新编译后可能超过 90 秒，遇到 ready 超时先重跑一次再判断。
