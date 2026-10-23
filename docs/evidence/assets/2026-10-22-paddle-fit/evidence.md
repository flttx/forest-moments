# 划桨握持与船舷间隙复核 · 2026-10-22

> **后续用户视觉否决：整版弃用。** 用户指出从起始帧就存在抱臂/拧肩，左右切换时手臂破面。以下数值仅是当时局部检查记录，不能证明姿态或蒙皮外观正确。此前将袖口异常归于“原蒙皮表现”的判断缺乏充分对比，撤回该归因。复核页已切回原始 paddle，生成/导出 IK 试稿入口已禁用；后续不得再采用本文件中的候选或推进其玩法集成。见 [恢复记录](../2026-10-22-paddle-original/evidence.md)。

## 结果与范围

已生成独立的船用划桨适配动作，并取得无头 Edge 实图。当前只完成动作/道具组合复核，**没有接入上船、划行、转向、靠岸或下船玩法，也不代表全身连续碰撞及最终用户视觉验收通过**。

浣熊仍采用 rig-mixamo-v6，船仍采用 structure-v2。未改源网格、衣摆、尾巴、蒙皮权重或原始 19 动作文件；新试稿只改派生动作的左右 Arm / ForeArm / Hand 共 6 骨，并烘焙独立桨的轨迹。217 帧对比中，其余 32 骨的局部矩阵与原 paddle 动作差值为 0。船比例、座位和人物实例位置保持原组合值；桨实例比例由 0.5 调为 0.48，没有减面。

## 调整依据与未采用方案

- 原组合 v2 的桨杆中心线有 76/217 帧穿舷，见上一轮 `canoe-assembly-v2/alignment.json`。
- `fit-scan.json`：45 组仅调整桨长/位置的试验，消除射线命中会导致最多约 13 cm 脱手，且部分方案右侧划动不入水，未采用。
- `exact-hand-scan.json`：48 组按原双手连线、调整船宽/深度和座位的试验仍有命中，未改变实际船形或座位。
- 参考 my-blog 的 `src/world/boat/paddlePlan.ts` 和 `CanoeScene.tsx` 理解换边与回桨；最终使用新船专用轨迹和 Blender 双骨 IK。保留原 Mixamo 身体节奏，增加抬桨、前方换边、重新握持和两侧入水。
- `candidate-v1-audit.json` 保留早期右舷穿透；`baked-v1-failed.json` / `baked-v2-failed.json` 保留整数帧正常、帧间手臂翻转的失败。修正四元数符号连续性、线性烘焙和肘部约束后复测。
- `high-grip-rejected/` 与 `face-contact-rejected/` 保留握点过高、手贴脸的浏览器图及诊断。数值握点对齐不能代替实际皮肤间隙检查；最终下移握点、调整桨角度与肘部朝向。

## 最终验证

| 检查 | 实际结果 | 边界 |
| --- | --- | --- |
| 桨杆、桨叶与原船体/补片 | 烘焙后 120 Hz、完整 7.2 s、865 样本，表面相交 0 | 网格表面采样，不是连续扫掠体积证明 |
| 握点 | 烘焙及帧间最大误差 0.7553 mm；循环接缝小于 0.001 mm | 目标为手骨中心，换边阶段安排释放手，不是手指闭合质量证明 |
| 头颈间隙 | 217 帧中手部/桨与头颈表面相交 0；握点至头颈表面最小距离约 71.85 mm | 采用对应骨权重 >50% 的面区域；未审计全身与衣物自碰撞 |
| 入水 | 左侧 55～101 帧、右侧 163～209 帧桨叶低于水位 -0.355 m | 仅几何水位；没有浮力、推进或水花反馈 |
| GLB / 浏览器 | 586642 三角面、41,534,192 B、1 条合并动画；Edge 155、1440×900，217 帧导出握点最大误差 0.0608 mm；实际播放 15 s 跨越两次循环，0 控制台异常 | 开发复核页、单机；未测新试稿性能和正式游戏过渡 |
| 静态与原文件 | lint、test 6/6、TypeScript/Vite build、Python/JS 语法通过；四项源/public/dist 哈希仍与前轮清单相同，原角色保留 19 动作 | 主 JS 1219.80 kB / gzip 336.74 kB，既有 >500 kB 提示未解决 |

机器结果：`candidate-audit.json`、`baked-audit.json`、`head-clearance.json`、`headless-validation.json`、`artifact-validation.json`。58 张最终及失败 PNG 已解码并记录哈希，其中最终无头截图 18 张。此轮未重新进行整场景昼/夕/夜、各地标或性能复测。

## 实际画面

同一无头 Edge 近景、同一动作时刻 6.33 s：

- [握点过高的未采用版](high-grip-rejected/headless-grip-close.png)
- [最终候选近景](headless-grip-close.png)
- [左侧入水姿势](headless-left-075.png)
- [抬桨换边](headless-right-027.png)
- [水位参考与播放后画面](headless-water-playback.png)

已查看两侧划动、换边及握桨近景；明显贴脸改善，桨在船外划动。袖口/披肩仍保留原蒙皮表现，未以本轮结果宣布服装细节或整体动作自然度通过。水位勾选只显示复核平面，不是正式水面效果。

## 可复现产物

- `assets/lux3d/round-01/canoe/paddle-fit-candidate.blend`：独立可播放工作文件。
- `assets/lux3d/round-01/canoe/paddle-fit-review.glb`：完整组合的开发复核文件；没有复制到 public 或 dist。SHA-256 `15166b60c3aa419c7080a69404d4a37a56d1eadc3f03dfa396e81002b76f61a3`。
- `scripts/aholo/adapt_paddle.py`：派生动作及独立桨轨迹。
- `scripts/aholo/audit_paddle_candidate.py`：烘焙、插值、原非手臂动作对比、GLB 导出。
- `scripts/aholo/audit_paddle_head.py`：实际蒙皮头颈与手/桨检查。
- `scripts/aholo/paddle-review.html` / `.mjs`：本地可暂停、拖帧、切换视角的复核页。
- `scripts/aholo/check_paddle_headless.mjs`：独立临时 profile / CDP；仅 headless Edge，无桌面鼠标、无现有浏览器连接。

启动 `pnpm dev --host 127.0.0.1 --port 5176 --strictPort` 后访问 http://127.0.0.1:5176/scripts/aholo/paddle-review.html 。Blender 脚本使用既有 `blender_run.py` 后台包装器运行，不修改系统 WMI 或 Blender 安装。

下一步把派生动作与独立桨接入码头交互，完成上船→前后划/转向→靠岸下船→恢复步行及重复操作验证。此轮没有付费 API、提交、推送或部署。
