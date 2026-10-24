# 钓鱼、张力收线与鱼簿闭环

日期：2026-10-23。继划船后继续 P3 钓鱼。保持已接受的浣熊 v6、衣服、尾巴、骨骼、权重与原动画；本轮未调用生成 API，未推送或部署。

## 实现与操作

走到池塘西岸（约 x=1.5、z=-5），F 抛竿；等待浮漂明显下沉并出现咬钩提示，F 提竿。按住 Space 收线，张力高时松开；收线完成后鱼出水，记录到右侧鱼簿。F 可继续下一竿，Esc 随时收起恢复步行。界面也提供抛竿/提竿按钮和按住收线按钮。

过早提竿、错过 2.4 秒咬钩窗口、张力达到上限或收线超时均失败，不增加鱼簿。失焦/页面隐藏暂停游戏计时并释放收线，回到页面按 F 主动恢复。每次成功仅在提鱼结束时记一次；fish-book:v1 独立存档保留总数、最大尺寸和最近 20 次渔获，不覆盖种树存档。损坏数据回退为空，写入失败会提示只在本次会话保留。

主要代码：src/game/fishing.ts、store.ts、src/world/FishingScene.tsx、ModelAsset.tsx、ForestWorld.tsx、src/FishingHud.tsx。只用已有 React / Three / Zustand，未新增依赖。

## 原动作与资产来源

角色原 SHA-256：`f35123a06d790a6802d20f278c4d2c23997ccf16c49dfd56923e6d8acf8a2a41`，仍为 38 骨、19 动作。实际读取并复用 fish_cast 3.2 秒、fish_hold 约 1.567 秒、fish_reel 2.4 秒、fish_land 约 1.167 秒。抛竿/提鱼停在终点，持竿/收线循环，动作时间随当前阶段控制；未重写源轨道或做手臂 IK。

| 资产 | 来源 | 本轮处理 |
| --- | --- | --- |
| 竹竿 | my-blog/public/assets/world/coast/coast-rod.glb；该项目 Blender 自制简洁竹竿，5 骨、竿尖 Locator | 逐字节复制至 public/assets/models/fishing-rod.glb；6336 B / 480 三角面 |
| 锦鲤 | my-blog/public/assets/world/coast/fish-koi.glb；原 Tripo ca298d92-f93b-428c-bc4e-02c27ddc8ff1 经 Blender 派生 | 逐字节复制至 public/assets/models/fish-koi.glb；139172 B / 4500 三角面 |
| 鱼线/浮漂/水圈 | 本项目 Three 几何 | 随竿尖、阶段和收线进度更新 |

my-blog 只读，未修改其文件。原构建清单条目、任务来源、尺寸和哈希保存在 [资产检查](asset-validation.json)；本轮没有重新执行 Blender，也没有新增付费生成或把旧辅助资产说成新的 Lux3D 产物。商业许可未独立重审，只记录本地原型复用事实。

两个模型新增 145508 B（约 142.1 KiB），源/public/dist 一致。八项运行时模型/轨迹共 96,700,103 B（约 92.22 MiB），完整资源预算仍待优化。

钓竿握点跟随实际左手中心，方向参考原项目抛竿的手坐标系，只变换道具。鱼线连接竿尖和浮漂，浮漂有抛物线飞行、咬钩下沉和收线靠岸；真实锦鲤模型在出水及渔获展示阶段出现。当前没有水下鱼群或鱼线物理。握点随动日志与截图不是双手表面接触、逐面穿模或连续零碰撞证明。

## 无头 Edge 证据

Edge 155.0.4283.62、1440×900、独立临时 profile、DPR 1。未连接用户浏览器、未控制主屏鼠标；键盘通过 CDP 输入，未注入玩家/钓鱼状态、坐标、随机种子或渔获来跳过流程。

- 开发全流程记录（本地原始记录：`headless-validation.json`）：抛竿取消恢复步行、过早提竿、错过咬钩、暂停/恢复、张力收放、成功提鱼、只记一次、再抛竿、持续拉线失败和刷新鱼簿通过；13 张截图，0 控制台异常。该轮在 HUD 调整前运行。
- 静态构建记录（本地原始记录：`production/headless-validation.json`）：最终 dist 实际加载、真实键盘/DOM 张力条收线、钓获与刷新保存通过，6 张截图，0 异常；`?qa` 无开发遥测。此轮包含最终 HUD 位置。
- 划船回归（本地原始记录：`rowing-regression/headless-validation.json`）：在新增钓鱼后，两次上下船、前后划、左右转向、岸边/停靠限制、失焦释放、恢复步行及两个原 paddle 循环均通过，10 张图、0 异常；保持原船/原角色。

已实际查看的关键画面：

- [原动作抛竿](production/01-cast.png) / [持竿和浮漂](production/02-waiting.png) / [咬钩提示](production/03-bite.png)。
- [收线面板初版](before-layout/08-high-tension.png) / [左下方面板](production/04-tension-panel.png)。
- [渔获被提示遮挡的初版](before-layout/11-caught.png) / [最终出水锦鲤](production/05-visible-catch.png)。
- [刷新后的鱼簿](production/06-saved-book.png)。

前后截图采用相同视角/流程，但鱼尺寸、动作时刻会受随机与真实输入时机影响，非像素级相同帧。初版提示遮挡鱼和角色下半身，已将钓鱼面板/提示移到左下方。只检查当前日间场景；昼夜、最终美术、多设备/手机和完全几何碰撞没有验收。本轮未录制新的完整玩法视频。

## 检查与复现

- pnpm lint：0 错误 / 0 警告。
- pnpm test：4 文件、15/15，通过停靠与钓点门槛、三类失败、张力收放、暂停、一次奖励、存档失败/损坏回退等契约。
- pnpm build：TypeScript / Vite 通过；主 JS 1235.79 kB / gzip 343.13 kB，既有 >500 kB 提示保留。
- 源/public/dist 哈希、图片解码、脚本语法和文档链接见 [最终检查](validation-results.json)。不把前轮静态池塘帧率作为钓鱼帧率，本轮没有新显存/公网加载/跨设备性能数据。

开发服务为 127.0.0.1:5176 时运行 `node scripts/aholo/check_fishing_headless.mjs`。构建后以 5178 启动 pnpm preview，再运行 `node scripts/aholo/check_fishing_production_headless.mjs`。划船回归以 FOREST_QA_OUT 指向本目录 rowing-regression/ 后运行既有 check_rowing_headless.mjs，未覆盖前轮证据。

当前完成一个西岸钓点、一种锦鲤的最小玩法及鱼簿；完整生态、更多鱼类、最终美术和用户外观验收仍待后续。PROGRESS.md 与项目报告 v0.23 同步更新。下一项按 P3 推进树苗成长。
