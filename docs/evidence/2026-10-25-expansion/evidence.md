# 扩岛地形与生活功能实施 · 2026-10-25

当前状态：按用户“开始进行”完成首版接入和本机限定功能验证；完整上下床、木工衣袖形变及崖壁/溪岸美术待继续细化。下方“历史概念阶段”保留先前暂停草稿的事实，不代表当前状态。

## 本轮实施与修订

- 北侧高地（卧室地基 7.3 m、塔基 7.8 m）、西侧海崖/下切溪谷/采样桥面、南侧宽沙滩、海边礁石和观赏座椅、东南营地。新增路径按高程和实际角色碰撞可达，桥南侧初版陡坡经真实按键测试发现后修成连续坡道。树线后退以保留沙滩，桥上不撒草石。
- 七个 AHOLO 资产全部接入，原始任务见 generation-summary.json；本轮实施未新建生成任务。Blender 归一化图与 *-blender.json、编码后 *-runtime.json 保留。原始 GLB/ZIP/.blend 保留本地 assets/；运行 GLB 在 public/assets/expansion/。新室内由 scripts/build_bedroom.py 本地建造，不是 AHOLO 生成。
- my-blog 座椅从 assets/blender/environment-kit/export/batch2-meshopt/low-bench.glb 原样复制，哈希一致；其三个原坐姿片段和角色原 GLB 保留。用户指出鱼缸偏大后缩至 72%：1.44×1.296×0.612 m（宽/高/深），水面、玻璃、鱼群和碰撞一致。implementation-v1/bedroom.png → polish/day-bedroom.png 为同机位白天前后对比。
- 卧室 F 进出/家具避让、床边 7 秒侧卧休息/提前起床、完成后白天和次数存档；鱼缸 5 条容量、捕获 ID 去重、游动/放归/刷新；篝火点燃/熄灭与三座营地椅、两处观赏椅；工坊原三步修整加入刨刀与木屑，完成后坐凳。
- 木工初版手不可达约 0.45 m，调整站位和基准姿态后换双骨骼解析 IK，最终三次完整刨削握点最大采样误差 0.003034 m。握点数值不证明所有衣袖/指节零穿插；近景仍能看到衣袖折叠，作为未完成美术项记录。

## 验证批次与边界

最终 lint 无警告、75/75 单测、build 通过（保留主包分块提示）。Windows Edge 156.0.4314.42、1440×900；全部用 scripts/browser-session.mjs 独立配置，并在最外层 finally 清理。

| 本地批次 | 图数 | 内容与结果 |
| --- | ---: | --- |
| final-v2 | 40 | 功能状态/真实 F、鱼缸 UI、三次刨削握点采样及昼夕夜九机位；PASS |
| navigation-v2 | 8 | 连续键盘过桥和卧室内通行、新位置观景/上下船、实际钓鱼张力控制到养鱼并刷新；PASS |
| polish | 6 | 最后沙滩退树、卧室顶棚后日/夜鸟瞰、海滩和卧室；PASS |
| production | 4 | 当前 dist 的键盘移动、鼠标环绕/缩放、无开发遥测；PASS |

四组无控制台错误。固定机位夹具会设置位置/模式，不能当作全部真实游玩；navigation-v2 的各段起点使用夹具，段内依靠实际键盘、相机和碰撞，不逐帧注入坐标。其钓获由 F/Space 完整闭环产生，再经鱼缸 UI 转入，未注入渔获。每个 headless-validation.json 是本地原始记录（Git 忽略）；可复现脚本为 scripts/check_expansion_views.mjs、check_expansion_navigation.mjs、check_expansion_polish.mjs、check_expansion_production.mjs。精简、可归档结果在 validation.json。

初版 implementation-v1/v2/v3、第一组 final 和 navigation/navigation-final 保留本地：包含鱼缸比例、平面水源、篝火形状、动作握点、桥南陡坡等中间问题；navigation-final 在产品入缸成功后因重新加载时过早读取旧 Canvas 导致测试报错，后加入新场景/持久化条件等待并重跑通过。错误批次不计入通过图数。

当前 public/assets 合计 98,749,789 B（约 94.18 MiB），新增九个 GLB 42,724,100 B（约 40.75 MiB）；逐项 dist 哈希一致。生产 localhost 新配置加载检查约 5.91 s，包含加载轮询，不是公网测速和 FPS。未提交、推送、部署或导出 PDF/PPT。AHOLO 七项的积分与商业授权仍沿用下方边界。

## 历史概念阶段（随后已获准实施）

用户先授权工坊动作/工具/坐凳、AHOLO 精细模型、扩岛/溪桥/礁石/沙滩/观赏点、可进入卧室/床上睡觉/养渔获鱼缸，随后追加篝火营地、指定椅子复用 my-blog；最后要求先做包含起伏、高地、沙滩、悬崖的整体概念。

## 方案与调整

第一份代码草稿仅扩大半径并加溪桥和互动，尚未完成视觉验证。用户指出扩岛需要完整地形层次，因此暂停实施；29 个源文件的改动副本和补丁保留在本机 `.tmp/expansion-draft-2026-10-25/`，当前 src 已恢复 fa86c2e 基线。未采用草稿不能直接套用到新地形。候选运行资产移入 `assets/expansion/draft-runtime/`，不随 dist 发布。

概念 v3 以旧概念 v2、旧场景鸟瞰和卧室单体图为参考，使用内置 imagegen 生成。北部高地/坡地卧室，西部海崖/溪谷/桥/入海口，中部牧场与独立淡水池塘，南部月牙沙滩/礁石，东南篝火/海上码头。第二次编辑移除工坊烟囱并明确溪流入海口。它是概念插画，不是游戏截图，图中的道路坡度、河流落差和建筑尺度尚需几何设计；概念里的椅子仅示意，实施使用 my-blog 原模型及坐姿。

概念原图：`docs/references/concept/forest-moments-expanded-island-v3-initial.png`；当前候选：`docs/references/concept/forest-moments-expanded-island-v3.png`。

提示词要点（非逐字转录）：warm mature hand-painted forest island; high oblique aerial, larger irregular island with walkable hills and 8–12 m high plateau, western layered sea cliffs, creek valley and footbridge with sea outlet, separate freshwater pond, generous crescent beach, reefs, workshop/pasture/bedroom/lookout, ocean dock/canoe, campfire and low benches; restrained greens/wood/stone, connected routes, no UI/text. 编辑要求：保留整体，只移除工坊烟囱并补清溪流入海段。

## 真实产物

7 个 AHOLO 任务均成功下载 GLB/ZIP，任务与哈希见 generation-summary.json。木工刨 4351839、卧室 4351842、床 4351845、桥 4351848、礁石 4351851、篝火 4352048、鱼缸 4352051。椅子没有提交生成，bench-unused-v1.png 为撤回参考。鱼缸参考来自 my-blog 的 library-fish-tank；低座椅来自该项目已适配版本。

余额接口 HTTP 500/非 JSON，上传/创建接口正常，报价与实际积分未核实。第六项首次创建返回明确的 GENERATION_CONCURRENCY_LIMIT_EXCEEDED；前三项完成释放名额后，对该拒绝请求重新提交并取得篝火任务 ID。没有对未知超时的创建请求重试。国内 AHOLO 端点沿用既有配置，不是 ModelScope 部署区域。

Blender 5.2.1 LTS 已完成木工刨/桥/礁石/床的归一化候选与离线图，未减面，尚未完成方向/手部接触/桥面/坐姿的实机验收。室内结构由 Blender 本地制作候选；不是 AHOLO 生成。木工刨/桥/礁石完成无损 WebP 与 Meshopt 编码。授权只记录用户本轮生成与复用指令，不据此声明商用许可。

## 检查边界

修改前实机 1440×900 截图在 before/，包含 fullIsland、interior、craft。它们是修改前基线，不是新方案实机成果。源代码草稿最后测试为 69/70，失败涉及新溪流出口改变原海岸高度假设；另有 lint 警告，未验收。归档恢复后的正式检查另见主报告与 PROGRESS，不能混淆。

恢复后：lint 无警告、70/70 单测、build 通过。归档副本最初保留 .test.ts 扩展名导致 Vitest 误扫描 6 个缺少上下文的归档套件；改为 .draft 后完整通过，不改测试配置。恢复草稿时以 runtime.patch 为原已跟踪修改，以 manifest.new 对应 .draft 文件为新增源码，不要将草稿当作已验收方案。
