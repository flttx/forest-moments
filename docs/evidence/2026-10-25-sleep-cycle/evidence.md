# 上床俯瞰日出与日落 · 2026-10-25

阶段：实现并完成本机限定验证。报告 v0.48 / 5.44。用户最新要求取消上下床动画，本轮不把该动作作为待办。

床边点击“上床休息”/F，根据小岛存档的当前时段选择：day/dusk → night，night → day。约 18 秒固定俯瞰全岛，太阳升降、天空/海色、月光与路灯同步变化；F/Esc/按钮跳到目标时段。完成只记一次，恢复室内相机与床边站位并保存昼夜。电脑时钟和全天自动时间流逝未接入。

## 实际执行

Windows / Edge 156.0.4314.42，1440×900，DPR 1。测试创建独立无头配置，复用 `scripts/browser-session.mjs`，TEMP/TMP 位于项目 `.tmp/`，最外层 finally 清理。

- `pnpm lint`：无警告。
- `pnpm test`：19 文件、80/80 通过。
- `pnpm build`：通过，保留原有大分块提示。JS 1335.23 kB / gzip 379.03 kB。
- `final-v2`：22 张，三起始时段自然完成、固定镜头、角色隐藏、单调光照、实际 night/disc uniforms、返回室内、F/Esc/按钮跳过、减少动态和刷新恢复；PASS / 0 errors。
- `horizon`：1 张，夜晚真实触发并等待约 6.2 秒，补拍太阳露出海面后的画面，随后 Esc 跳到白天；PASS / 0 errors。
- `regression`：21 张，day/dusk/night × 鸟瞰/角色/工坊/池塘/牧场/木塔/卧室；PASS / 0 errors。选取各地点关键图作人工复核，未声称重跑所有旧玩法。
- `production-final`：4 张，最新 dist 在 5178 端口加载、按键/镜头、无开发遥测；PASS / 0 errors。生产冒烟未重新走到卧室完成完整休息，完整休息在开发环境实测。

共 48 张最终截图；每组原始 `headless-validation.json` 与未引用图片只保留本机，Git 保留精简 validation.json 和报告引用图。源文件哈希、构建哈希、浏览器/采样/资源一致性见 [validation.json](validation.json)。35 项资源共 98,749,789 B，与上轮及 dist 一致；无新资产、生成调用、上传或部署。

## 真实问题与改进

`initial` 与 `final` 两轮各 22 张，流程检查 PASS 但人工画面复核未完成通过：initial 有远海硬边，final 雾已绑定 Scene，但天空标量未同步造成夜间暖云。改为实际 ShaderMaterial uniforms 更新后，最终 `final-v2` 正确显示蓝色夜空；太阳光晕在海平面以下收敛，低角度阴影渐淡。中间图保留，不将数值 PASS 冒充视觉通过。

一次生产复测未读取输出环境变量，覆盖了上轮 expansion/production 的本地原始截图与原始日志（上轮精简汇总、主稿引用图未改）。现脚本支持 FOREST_QA_OUT，本轮最终产物独立保存在 production-final；被覆盖的旧原始批次不可冒充历史原件。最后对 skyMaterial 尚未就绪的空值保护做 lint 修正，不改变已挂载的视觉行为；最终生产包在该修正后构建并冒烟。

## 报告引用图

- `initial/day-3.png` 与 `final-v2/day-3.png`：同一日落机位、约 12 秒阶段，远海硬边修复前后；云/水纹不是同一帧。
- `final-v2/day-4.png`：同一机位的最终入夜，灯火亮起。
- `horizon/sunrise-horizon.png`：相反方向的日出，不能与日落图当作同机位对照。
- `final-v2/night-returned.png`：日出完成，返回床边。

图像均为真实浏览器截图，无新增概念图。未新增 Lux3D/AHOLO/Blender 产物；模型与使用权沿用上轮资产记录。风格化晨昏不代表天文精确位置，环境反射仍沿用静态贴图随强度变化。木工衣袖、崖壁/溪岸美术、养鱼经营和跨设备性能继续沿用已有边界。

## 复现

先启动本地 Vite 5176 和 dist 预览 5178。PowerShell 中设置 `$env:FOREST_QA_OUT` 指向新的项目内目录，避免覆盖旧证据，再运行：

- `node scripts/check_sleep_cycle.mjs`
- `node scripts/check_sleep_horizon.mjs`
- `node scripts/check_sleep_lighting_views.mjs`
- `node scripts/check_expansion_production.mjs`

脚本使用明确床边/时段夹具设置起点，随后真实点击或键盘触发；不强行推进睡眠计时，不据此声称已重走从出生点到小屋路线。构图/高程/鱼缸比例和原模型来源参见上一轮扩岛证据。
