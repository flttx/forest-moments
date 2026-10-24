# 原桨复用与换手轨迹 · 2026-10-23

状态：部分验证，船桨配合未完成，未接入正式划船玩法。

## 来源与范围

- 角色：public/assets/models/raccoon.glb，既有 rig-mixamo-v6 与原 paddle 动作。SHA-256 f35123a06d790a6802d20f278c4d2c23997ccf16c49dfd56923e6d8acf8a2a41。
- 船与桨：public/assets/models/canoe.glb（structure-v2），直接复用 Paddle_shaft、Paddle_blade 及原材质。SHA-256 0adaf76fee4d01db337c7499760396fd9642159756b95551c092080fc9eb6ec9。
- 没有新生成模型、付费调用、网格/权重/衣服/尾巴修改、提交或部署；原资产使用权状态沿用资产台账，本次复用不新增授权结论。
- 离线读取 assembly-review-v2.blend，逐帧断言无骨骼 constraints、桨变换前后所有骨 matrix_basis 不变。只写 prop-track.json，不导出或覆盖 GLB。
- 对照 my-blog 的 CanoeScene.tsx / paddlePlan.ts：旧项目也单独计算桨方向与碰撞避让，不是现成随动作一起运动的桨轨道；本轮没有复制其碰撞修正作为新模型通过的依据。

## 变化与证据

脚本 scripts/aholo/attach_original_paddle.py 让前方手在换边时支撑桨，延后双手握合，换手期间滑向柄端并让桨朝前，降低柄端伸入脸部的风险。道具整体实例比例 0.38；船仍为 0.5、角色位置/比例不变。换手释放手最大离轴约 18.35 cm，不声称全程双手握持。

- 上轮轨迹：../2026-10-22-paddle-prop/prop-track.json，217 帧中头颈相交 45 帧、船体 77 帧。
- 本轮中间候选：before/prop-track.json（本地原始记录：`before/prop-track.json`），头颈相交 33 帧；同机位截图与浏览器结果保存在 before/。
- 当前轨迹：prop-track.json（本地原始记录：`prop-track.json`），头颈表面相交 0/217，船体/船体补片相交 77/217（72–102、164–209）。这是实际网格 BVH 离散采样，不是帧间、全身或全部接触的零碰撞证明。
- 换手对比：[第 43 帧之前](before/headless-right-043.png) → [当前](headless-right-043.png)；[第 139 帧之前](before/headless-left-139.png) → [当前](headless-left-139.png)。当前柄端不再明显穿过嘴侧。
- 未通过项：[第 190 帧](headless-right-190.png) 桨明显穿过船舷；不能因为握点误差很小就标为可用动作。
- layout-scan.json 只诊断杆中心线与缩放/移位组合，没有应用；零命中候选需要把船缩小约 55%–60%，未验证人物容纳，也未采用。

## 实际验证

- 独立无头 Edge，1440×900；没有连接用户现有浏览器，没有桌面鼠标输入。
- headless-validation.json（本地原始记录：`headless-validation.json`）：217 个源手位对照样本，最大误差 0.0044 mm；支撑手误差 0.0069 mm；非换手段双手离轴最大误差 0.0048 mm。15 秒播放跨越两次循环，0 控制台异常，22 张最新截图。
- 两侧 0/27/43/55/75/108/139/151/163/190 帧、190 帧近景及水位播放截图均来自真实页面。人工查看 43、139 同机位前后图及 190 穿舷图；没有宣称每帧皮肤质量或全部视角通过。
- pnpm lint、pnpm test（6/6）、pnpm build、Python AST、两个 JS node --check 通过。主 JS 1219.80 kB / gzip 336.74 kB；既有 >500 kB 告警保留。

下一步：核对船内座位/比例与原动作的空间兼容性；保留角色及原动作，不再用手臂 IK 消除道具碰撞。复核入口：http://127.0.0.1:5176/scripts/aholo/paddle-review.html 。
