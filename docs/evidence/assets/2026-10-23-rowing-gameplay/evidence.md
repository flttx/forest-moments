# 划船往返玩法接入

日期：2026-10-23。当前范围是把已校准的中央座位、原浣熊动作和原桨接入正式游戏。没有新 API 生成、减面、角色网格/衣服/尾巴/权重修改、提交、推送或部署。

## 实现与操作

沿池塘右侧走到木码头前端，F 上船；W 前划、S 后划、A/D 转向；松开按键减速。回到木码头旁停稳，F 或界面按钮下船，恢复正常步行。离开码头不能下船；失焦、隐藏页面会清理按键。可重复上船、划行、返回和下船。

`src/game/rowing.ts` 管理运动、水域边界和停靠条件；`store.ts` 管理步行/划船切换与安全落地点；`RowingBoat.tsx` 只使用模型整体变换和原动画。角色与桨共享 7.2 秒相位，后划反向播放原动作。船长约 3.35 m，以保守矩形完整约束在半径 4.05 m 的池塘内，近岸转向也检查船头/船尾，并保守排除码头伸入水面的占用范围。水波随操船出现，限定在池塘内，系统减少动态效果时关闭附加水波。

上下船当前直接切换状态与位置，没有迈步登船过渡。固定水线与运动学控制没有浮力或流体模拟；桨端/岸边细节没有逐面碰撞。停止时保留当前原动作姿势。

## 资产与来源

- `public/assets/models/canoe-center-seat.glb`：逐字节复制 `assets/lux3d/round-01/canoe/center-seat-v11.glb`，17,372,336 B / 280265 三角面；不再显示原船低座位。
- `public/assets/models/paddle-track.json`：逐字节复制前轮最终 120 Hz / 865 点轨迹，654,759 B。
- 角色仍为 rig-mixamo-v6 原 GLB，38 骨、19 动作；直接播放 `paddle`，没有 IK 或骨骼覆盖。人物保留中央 XY 与整体 +26 cm 的校准变换。原桨从原 canoe.glb 提取两个既有网格，保留原局部变换与材质，比例 0.5。
- 角色、原船、派生船、轨迹及构建输出哈希见 [资产检查](asset-validation.json)。六项 public 模型/轨迹与 dist 逐字节一致，合计 96,554,595 B（约 92.08 MiB）。仍需读取原船 GLB 提取桨，下载体积尚未达初版目标；可后续独立导出桨和无损压缩，未因此强制减面。
- 继承 [前轮配合证据](../2026-10-23-paddle-final/evidence.md) 与 [Lux3D / Mixamo 接入来源](../2026-10-22-runtime-integration/evidence.md)。没有新积分消耗或新增商业授权结论。此前 865 点几何检查是局部配合的采样证据，本轮不是重新逐面证明全场景连续无碰撞。

## 真实浏览器证据

全部使用独立无头 Edge 155.0.4283.62、1440×900、临时 profile；不连接用户浏览器，不控制主屏鼠标。操作通过真实 CDP 键盘/页面按钮，未注入玩家或船坐标来跳过流程。

1. [玩法机器记录](headless-validation.json)：两次上/下船、前后划、左右转向、持续顶岸、不能在水中下船、失焦停船、按钮焦点后继续用键盘与返回步行；两个原 paddle 循环，角色/桨时钟最大差 0，0 控制台异常。10 张截图。
2. [原玩法回归](regression/headless-validation.json)：待机/走跑、输入框排除、失焦释放、工坊/池塘碰撞、码头高度、栽苗及刷新存档通过，0 异常。固定池塘预热后 30 秒 RAF：均值 59.34 FPS，P95 16.8 ms，最大间隔 350 ms；不是整个划船过程、GPU 或跨设备性能验收。
3. [静态构建检查](production/headless-validation.json)：dist 页面实际加载六项模型/轨迹资源，键盘上船和划行通过，`?qa` 不泄露开发遥测，0 异常。最后的水波显示顺序/透明度修正后重新构建并复跑该项。

截图与检查目的：

- [码头上船前](02-dock-before-boarding.png) / [中央落座](03-central-seat.png)：同次实际交互前后。
- [前划](04-rowing-away.png) / [转向](05-turn-left.png) / [岸边限位](06-shore-limit.png)：运动和水域约束。
- [返回码头](07-returned-to-dock.png) / [下船](08-back-on-dock.png) / [恢复走路](09-walking-again.png)：重复闭环。
- [水波修正前](production/before-water-feedback.png) / [静态版本水波修正后](production/02-built-rowing-water.png)：相同视角/路线，实际运行时刻略有差异；原水波被透明水面覆盖且偏淡，修正后船尾水波可辨。

已实际查看中央落座、转向、岸边、下船及静态版本水波图。标题与远处木塔/树木背景重叠等既有灰盒问题仍在；只有当前日间场景，没有虚构昼夜或最终美术验收。本轮没有新玩法视频，前轮独立模型动作视频不能替代完整玩法录像。

回归脚本原默认输出指向 10 月 22 日目录，本次首次回归刷新了其中同名 headless 截图。原机器记录已保留为 `headless-validation-2026-10-22.json`，历史说明已标注图片刷新；最新一套另外归档到本目录 regression/，脚本默认输出已改为新位置并支持 FOREST_QA_OUT。

新增码头占地阻挡后，首次全流程脚本仍要求倒划至固定 z < -5.95，发生超时；失败图已显示“已靠近码头”和可用下船按钮。保留 [机器记录](dock-limit-script-adjustment/headless-validation.json) 与 [截图](dock-limit-script-adjustment/headless-failure.png)。脚本改为返回距本次初始停靠位置 0.5 m 内后松键，符合产品的停靠范围；没有放宽生产碰撞或下船门槛。

## 验证与复现

- `pnpm lint`：0 错误 / 0 警告。
- `pnpm test`：3 文件、10/10 通过，新增停靠门槛、资源未就绪、重复上下船、安全落地点、整船边界、前后运动和松键减速检查。
- `pnpm build`：TypeScript/Vite 通过；主 JS 1,225.52 kB / gzip 339.21 kB，既有 >500 kB 提示保留。
- `git diff --check`、脚本语法、资源哈希与图片解码结果见 [最终文件检查](validation-results.json)。

开发服务在 127.0.0.1:5176 时运行 `node scripts/aholo/check_rowing_headless.mjs`；既有流程回归运行 `node scripts/aholo/check_runtime_headless.mjs`。构建后运行 `pnpm preview --host 127.0.0.1 --port 5178 --strictPort`，再执行 `node scripts/aholo/check_rowing_production_headless.mjs`。静态检查的键盘路线按当前 PC 原型速度和布局设置，不作为低帧率设备的可靠自动导航。

当前完成划船最小闭环；整体视觉、资源下载性能、登船过渡和其他玩法仍待后续。报告 v0.22 与 PROGRESS.md 已同步。
