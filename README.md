# 森林拾光 · Forest Moments

一个独立的、温暖童话风格的 3D 微型森林生活世界。项目专为浏览器 PC 端创建。

## 当前原型

操作参考本机 my-blog：WASD/方向键相对镜头水平朝向移动，浣熊转向行进方向。右键拖动环绕/俯仰，滚轮调整远近，Q/E 环绕；按住 W 转动镜头即可连续转弯。步行时镜头保持玩家选择的方向，不自动追着角色转。室内靠墙收近并抬高镜头。划船支持鼠标环绕，停止调视角 1.5 秒后逐渐回到船后；塔上支持右键环顾。钓鱼、制作、添料、树苗观察及过场保留专用镜头，退出后恢复自由控制。

界面右上角工具条可切换中文/English（默认中文，选择记在本机），并可隐藏界面看纯画面；H 键同样切换，隐藏时仍显示错误提示和进行中玩法的卡片。界面字体为霞鹜文楷子集（SIL OFL 1.1，许可见 `public/fonts/LXGW-WenKai-OFL.txt`），由 `scripts/build_ui_font.py` 按界面实际用字生成，修改文案后需重新生成。

已接入浣熊模型与原骨骼动作、工坊、木塔、木船和海边码头；支持 WASD/方向键行走、Shift 奔跑、F 互动、四阶段树苗成长与存档、池塘钓鱼与鱼簿、海上绕岛及返回码头。工坊与瞭望塔分处岛的两侧，东岸沙滩接入新码头。靠近种植角按 F 栽种，Esc 可取消；小苗从单茎到分叉、幼树、成树，种下后 45 秒/2 分钟/4 分钟切换，离线时间计入成长，F 或走动退出观察。牧场已有一鸡一羊巡游，从北侧开口进入、在食槽左边按 F 添料，Esc 可取消；动物走到食槽吃完后保存喂养次数。尚无繁殖/采蛋/剪毛/经营系统。

工坊正门按 F 进入完整室内，WASD 行走，门厅靠门按 F 返回小岛。先在工坊东侧路边收好旧木墩，再进屋走到木工台前，F 开始三次节奏修整、Esc 暂停；成品留在室内，刷新保留材料/成品。当前沿用通用弯身动作，专用木工手部动作、坐凳和自由摆放尚未实现。

走到瞭望塔东侧楼梯脚，F 进入平台观景视角；A/D 或左右键环顾，W/S 或上下键俯仰，F/Esc 或按钮返回原落脚点。该功能为第一人称观景模式，逐级爬楼、平台自由行走与攀爬动画尚未制作。

上下船加入短暂淡入淡出，期间锁住重复互动与移动；航行加入轻微船体起伏、桨叶触水涟漪和留在水面上逐渐消散的尾流。系统减少动态效果设置会停用起伏与水痕。当前仍为运动学操船，专用跨舷动作和浮力物理未实现。

已按[场景升级计划](docs/SCENE_UPGRADE_PLAN.md)迁入 my-blog 生产树木、灌木、草花和木灯，扩大可走外圈，加入自然小路的微起伏与碎石细节。船在岛岸向外 12 m 范围内航行，需回东岸泊位平行停稳后下船。当前限制与实际验证见 [PROGRESS.md](PROGRESS.md)。

## 本地命令（Node.js 24+ / pnpm）

```powershell
cd F:\Projects\forest-moments
git lfs install
git lfs pull
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm preview
```

运行时模型位于 `public/assets/models/`、`public/assets/vegetation/` 和 `public/assets/interiors/`，GLB 通过 Git LFS 保存；首次克隆必须拉取 LFS 文件，否则模型无法加载。四大模型完成无损编码，并将取桨所需的整船下载替换为 9536 B 独立原桨；原模型、轨迹及植被编码后为 51.82 MiB（原 99.14 MiB），加复用工坊室内与烘焙光照后当前合计约 53.43 MiB。面数、贴图尺寸和动作保持，详见[报告 5.31](docs/report/PROJECT_REPORT.md)。按用户最新要求，体积仅作可调整的参考指标，以画面质量和实际加载体验决定优化，不以固定数字阻塞玩法开发。

仓库包含运行代码、运行时资源、验证/建模脚本和精选证据。`assets/` 下原始下载包、Blender 工作文件及模型候选仅在本地保存；离线建模脚本需要这些源文件及 Blender，不能只凭仓库重做全部历史模型。运行项目和构建不依赖这些本地源文件。批量截图不随提交发布，证据保留范围见 [证据说明](docs/evidence/README.md)。

## 开发约定

- AGENTS.md：必须遵循的代码、美术与文档纪律。
- PROGRESS.md：当前实现进度和待完成项。
- docs/PRD.md：范围、需求与验收标准。
- docs/ART_DIRECTION.md：成熟手绘童话森林美术基线。
- docs/ASSET_PIPELINE.md：Lux3D/Blender/GLB 模型生产和授权。
- docs/report/PROJECT_REPORT.md：**参赛报告书长期维护主稿**。
- docs/REPORT_WORKFLOW.md：每轮开发如何同步报告和真实截图。
- docs/DEPLOY_MODELSCOPE_AI.md：只部署到国际站 https://www.modelscope.ai 的 Static 模式。
- docs/SKILLS.md：官方部署 Skill 和项目自定义 Skill 列表。

## 安全与部署

部署目标：国际站 ModelScope.ai，正式操作需要本人 Token 和授权。本地的任何源码、图像参考、报告草稿及密钥都不应直接发布。发布仅同步构建后的 dist 文件。当前项目没有上线。

## 核心技术

React 19 + TypeScript 6 + Vite 8 + React Three Fiber / Three.js + Zustand。已接入部分 Lux3D / Blender 资产；后续逐项替换占位并复核使用权、性能和实机视觉表现。
