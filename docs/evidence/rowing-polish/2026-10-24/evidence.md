# 上下船镜头过渡与水面反馈 · 2026-10-24

主稿：[PROJECT_REPORT 5.29](../../../report/PROJECT_REPORT.md)。本轮继续既定划船计划，范围为镜头过渡和水面视觉反馈；专用跨舷动画、浮力物理仍未实现。

状态：本机限定验证完成。最终七组检查均通过、0 控制台异常，共 71 张真实截图；不包含开发前、失败和接触表图片。

## 来源与实施

- 参考沿用 [海边栈桥 v1](../../../references/waterside/forest-moments-seaside-jetty-v1.png)，源自上一轮 AHOLO 码头流程。本轮不制作新网格或动画，没有新参考图生成、AHOLO 请求、Blender 产物或费用；保留已有许可边界。
- 船、中央木座、角色及原 paddle 动作/桨轨迹沿用既有版本。十二个运行 GLB、原 120 Hz 轨迹与植被哈希核对未变，public/dist 一致。模型/轨迹/植被仍为 103039613 B（98.27 MiB）。
- `boatPresentation.ts` 定义 0.85 秒过渡、0.4 秒状态提交与水面偏移。遮罩 0.32–0.48 秒全不透明；此时切换角色与相机，期间拦截重复 F 和移动。完成后恢复控制，停船/方向/距离判定沿用原逻辑。
- `RowingBoat.tsx` 对船、人物、原桨的共同父节点应用最多约 2 cm 升沉、0.52°/0.69° 俯仰/横摇；泊位 0.8 m 内振幅为零，到 2.1 m 平滑增至全幅。只改变显示，导航与相机不随之颠簸。
- `BoatWaterFeedback.tsx` 复用 28 槽水痕池。尾流按约 0.28 m 航行距离发射，倒划反向；桨叶约 128 个原始顶点变换到世界坐标，用最低抽样点触水判断生成桨痕，冷却 0.22 秒。先检查生成点及扩散范围的水域/码头，再固定在水面扩散淡出。桨痕/尾流寿命 1.6/2.4 秒，停桨后消散。
- 减少动态效果实时响应：关掉起伏与所有水痕，航行控制保持可用。上下船仍用短遮罩完成状态切换，无大幅镜头追赶。

## 实图与核验方法

开发前生产包截图和 JSON 在 before（本地原始记录：`before/headless-validation.json`）。最终生产图在 production（本地原始记录：`production/headless-validation.json`）。两者来自同一白天上船流程/跟随相机；船位、动作时相可能不同，不能作严格逐像素对照。主稿直接嵌入前后图、过渡帧、桨痕和三时段航行图。

本机环境：Windows，隔离无头 Edge 156.0.4314.42，RTX 5060 Ti，1440×900，开发 5176 / 生产 5178。所有移动和互动用真实键盘；开发遥测仅读取。没有通过写入游戏位置/模式使测试直接通过，生产包不含开发遥测。

| 检查（均通过） | 记录 | 实际截图数 |
| --- | --- | --- |
| 白天完整上下船/水面 | development（本地原始记录：`development/headless-validation.json`） | 11 |
| 黄昏相同流程 | dusk-final（本地原始记录：`dusk-final/headless-validation.json`） | 11 |
| 夜间相同流程 | night-final（本地原始记录：`night-final/headless-validation.json`） | 11 |
| 三时段默认/鸟瞰/池塘/工坊/塔/牧场/角色/码头与减少动态 | views-final（本地原始记录：`views-final/headless-validation.json`） | 25 |
| 生产上下船/返航 | production（本地原始记录：`production/headless-validation.json`） | 3 |
| 生产栽种、真实 45 秒成长、刷新与离线夹具 | growth-production（本地原始记录：`growth-production/headless-validation.json`） | 4 |
| 生产钓鱼、鱼簿存档 | fishing（本地原始记录：`../../vegetation-expansion/2026-10-24/regression-rowing-polish-final-fishing_production/headless-validation.json`） | 6 |

水面检查包括：遮罩提交点不透明、重复 F/移动锁定、泊位静止、离泊起伏边界、按航行距离发射尾流、原桨触水发射、水痕世界坐标在船转向时不变、停桨消散、实时减少动态效果、失焦后下船完成、重复上下船和真实步行回岛。白天采集 483 条过渡记录、80 个水面样本，33 次桨痕/17 次尾流，采样中最多同时存在 7 条水痕。阴影、握桨、船体相对关系沿用共同父节点，未重做原蒙皮几何审计，不扩大此前限定审计结论。

## 修正与失败保留

第一次 lint 对 useMemo 可变水痕池给出两条不可变性警告，改用 ref 管理；新测试对 `-0` 与 `0` 精确比较失败，明确返回中性零姿态后通过。随后 lint 无警告、34 项单测/10 文件通过，构建通过；主 JS 1277.34 kB / gzip 359.47 kB，既有大包提示保留。

首次同时启动多个重场景浏览器后，出现纹理/着色器错误、截图超时，本地开发服务退出。未证明唯一根因，不将失败算成通过；失败 JSON 分别保留在 `views/`、`dusk/`、`night/` 和 `regression-rowing-polish-fishing_production/`，部分失败未能取得截图。重启开发服务后改为逐组执行，最终结果以 final 目录和 [validation.json](validation.json) 为准。没有降低画质或删除错误来取得结果。

恢复工作时，临时目录维护已将浏览器启动迁入共享 `scripts/browser-session.mjs`。钓鱼包装器生成到新目录后仍保留原相对导入，第一次启动报告 `ERR_MODULE_NOT_FOUND`（未启动浏览器，无新截图）；改为绝对模块 URL，并使用项目临时目录、最外层 finally 删除生成脚本和空目录后，生产钓鱼及清理均通过。视图脚本多余的未使用函数一并移除，最终 lint 无警告；此次工具修复不改变游戏包，构建 JS 哈希仍对应本轮实机产物。

## 复核与边界

本轮没有新 30 秒帧时基线，不把多窗口失败归因于已确诊的设备问题，也不声称跨设备性能达标。水痕是有限程序圆环，抽样触水不是完整水线求交；船的起伏是显示偏移，不是浪面或动力模拟。上下船仍缺专用跨舷/扶舷/坐下/起身动作。下一步为牧场参考、设施和最小喂养闭环。

本地服务就绪后逐组执行，避免多个重场景同时竞争资源：

```powershell
pnpm lint
pnpm test
pnpm build
node scripts/check_rowing_polish.mjs
$env:FOREST_RENDER_STAGE='dusk-final'; $env:FOREST_QA_LIGHT='dusk'
node scripts/check_rowing_polish.mjs
$env:FOREST_RENDER_STAGE='night-final'; $env:FOREST_QA_LIGHT='night'
node scripts/check_rowing_polish.mjs
$env:FOREST_RENDER_STAGE='views-final'
node scripts/check_rowing_views.mjs
python scripts/audit_rowing_polish.py
```

审计记录截图 SHA/尺寸、代码 SHA、资产不变性及本地链接，不包含密钥。未提交、推送、部署或导出报告。
