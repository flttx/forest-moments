# 四项模型接入与船内组合检查

2026-10-22。用户已接受当前尾巴、要求保留衣摆并继续。保留浣熊 rig-mixamo-v6、工坊 structure-v2、木塔 structure-v3、船 structure-v2；仅复制 GLB 和调整实例整体变换，源网格、蒙皮、贴图及动画未改。本轮没有付费 API、推送或部署。

## 接入内容

- 四个 GLB 逐字节复制到 public/assets/models，构建输出也必须与来源哈希一致。合计 78527500 字节，约 74.89 MiB；四项合计 1152010 三角面。未减面或压缩，不把体积大小单独作为必须减面的理由。
- 角色目标静态高度约 1.4 米，工坊约 3.87 米，木塔约 6.8 米，船长约 3.3 米。使用独立 SkeletonUtils 克隆与 AnimationMixer 播放已有 idle/walk/run；切换淡入淡出 0.2 秒，行走/奔跑速度 1.1/3.08，转向平滑。动画更新与位移均限制单次 delta 至 0.05 秒。
- 基础水平碰撞覆盖岛界、池塘、工坊、整座木塔的保守包围范围、牧场小屋和松树主干；位移拆分为不超过 0.12 米的子步，可沿墙滑动。并非逐三角面物理，尾巴、篱笆、灯杆、小石块与楼梯通行没有完整碰撞认证。
- 加载期间显示提示，角色就绪后允许移动；加载错误可重试。码头顶面降至 0.12 米并跟随脚底高度，避免按地面高度走入甲板。小台阶仍为直接高度切换，没有攀爬动作。
- 去除水面和建筑占用区域内的占位石头；船实例高度从 0.15 调整至 0.39，避免水面覆盖舱内。该静态摆放不代表已有浮力模拟。

> 2026-10-23 回归补充：本目录 headless-*.png 已由接入划船后的同机位回归刷新，不再代表 10 月 22 日的原始画面。原运行记录保存在 headless-validation-2026-10-22.json；最新截图与机器记录同时归档至 ../2026-10-23-rowing-gameplay/regression/。脚本默认输出已改到新目录，后续运行不覆盖本历史目录。

## 无头 Edge 验证

用户要求“用无头 edge 验证，不要抢占主屏鼠标”。后续验证采用 `--headless=new`、独立临时 profile、仅本机随机调试端口，无 Page.bringToFront、不连接现有用户浏览器、不发送桌面鼠标输入。脚本复用 my-blog 的 CDP 交互模式，不新增依赖；profile 放系统临时目录，避免 Vite 监视器锁文件告警。

先前通过 Computer Use 看到了实际加载画面，用户 Esc 后立即停止该界面操作；保存的 [初次画面](browser-initial.png) 只代表当时状态。用户之后明确授权无头验证。

执行入口：`node scripts/aholo/check_runtime_headless.mjs`，开发服务 `http://127.0.0.1:5176/?qa`。`?qa` 只在开发环境提供只读位置/动作遥测，生产构建移除。脚本使用浏览器键盘事件实际驱动角色，读取真实 mixer 动作与位置，失败退出非零。

环境：Edge 155.0.4283.62，WebGL2，ANGLE / NVIDIA GeForce RTX 3050 / D3D11，1440×900、DPR 1。验证范围包括四模型就绪、idle/walk/run、碰撞后待机、blur 清按键、输入框排除、工坊阻挡、池塘阻挡、码头脚底与栽苗后刷新存档。最新结果以 [机器记录](headless-validation.json) 为准。

固定池塘机位预热 2 秒、RAF 采样 30 秒约 60 FPS，P95 约 16.8 ms；没有把帧间隔当作 GPU 耗时或全场景/全设备验收，也未测峰值内存和真实公网冷加载。约 230 万绘制三角面含阴影等绘制通道，不等于资产几何面数翻倍。

过程中预览服务曾停止，导致加载检查超时；保留 [失败记录](service-stopped-validation.json) 和 headless-failure.png。恢复 5176 服务后复测；失败没有被解释为模型缺失或静默删除。

截图：[出生点](headless-spawn.png)、[走路](headless-walk.png)、[跑步](headless-run.png)、[工坊碰撞](headless-workshop-collision.png)、[池塘](headless-pond-collision.png)、[码头](headless-dock.png)、[树苗](headless-seedling.png)。初版船舱水面穿入图保存在 before-waterline/，均为真实浏览器截图。

## 角色、座位与桨组合

Blender 5.2.1 LTS / Cycles，1100×900，使用同一角色和船源文件，场景中只加父级整体变换。中央座面射线高度 -0.11709（船原点坐标，缩放后），角色以髋部定位到座面上方约 0.14；保留原 paddle 动作，船与独立桨按 0.5 缩放。

v1 用错桨的指向，[帧 162](canoe-assembly/paddle-162.png) 桨叶朝上，不采用。v2 反转握持方向并用实际桨杆轴线对齐双手骨中心：[起始姿势](canoe-assembly-v2/paddle-000.png)、[中段](canoe-assembly-v2/paddle-108.png)、[划桨姿势](canoe-assembly-v2/paddle-162.png)、[侧面](canoe-assembly-v2/side.png)。两版各 6 张真实渲染，独立保存 assembly-review.blend / assembly-review-v2.blend；未导出覆盖角色或运行时文件。

**组合尚未通过连续碰撞验证。** 217 个动作帧逐帧检查中，76 帧的桨杆中心线与原船体相交；[完整坐标与命中帧](canoe-assembly-v2/alignment.json) 已保留。双手骨中心对齐不是手掌握实的证明；桨叶厚度、身体/尾巴与船的完整接触尚未认证。静态尺寸可容纳角色，但目前不能直接作为正式划船动作接入。下一步应调整船桨相对握点与船内布局/动作使用方式，保持用户接受的角色文件不变。

## 证据与限制

模型来源见 [清单](manifest.json)；继承原 Lux3D 任务与 my-blog 动作来源，商业授权状态未被提升为已核实。脚本 `audit_runtime_assets.py` 核对源文件、public、dist 哈希，解析 GLB/19 动作并解码全部 PNG；结果见 [文件检查](asset-validation.json)。

最终 lint 0 错误/0 警告、test 6/6、TypeScript/Vite build 通过；主 JS 1219.80 kB、gzip 336.74 kB，仍有 >500 kB 提示。四项源/public/dist 哈希一致、19 动作和 26 张 PNG 可读。实际结果同步到 PROGRESS.md 和报告 v0.14。

初始场景里木塔顶部会出画、标题偶有模型背景重叠，林木/牧场/地形仍为灰盒；种树存档检查截图也暴露固定种苗点与站在该点的角色重叠，该问题不在本轮修整范围，后续需预留种植空间。昼夜、美术统一、完整动作循环的近景审查和真实玩法仍待后续。种树测试只证明互动与刷新后的存档，不代表视觉通过。
