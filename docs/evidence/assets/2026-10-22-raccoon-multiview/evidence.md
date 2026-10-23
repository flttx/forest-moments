# 浣熊现有四视图重生成与尾根复核

日期：2026-10-22。状态：生成和下载成功，**尾根视觉复核未通过**。没有替换游戏角色。

## 输入与生成

用户指出旧浣熊尾巴连在衣服上，明确要求重新生成，并指定复用 `docs/references/player` 已有多视图。本次采用四张独立 PNG，按正面、背面、左侧、右侧顺序上传，第一张为主参考；不是上传带标题的拼板。四图原文件与上传副本的 SHA-256 完全一致，见 [输入来源](inputs.json)。此用户选择优先于历史清单中对这些图的 superseded 标记，未改动原参考图。

- 官方 Lux3D，中国区 `https://api.aholo3d.cn`，任务 **4268120**，状态 3 成功。
- `POST /lux3d/v1/generate/img-to-3d/task/create`，参数 `imgs` 四项，`version=G1`、`faceCount=300000`、`outputFormat=["zip","glb"]`。
- 只创建一个新 3D 任务；没有调用四视图生成 API。创建无自动重试，上传恢复核验输入顺序/哈希、路由、参数与台账阶段。
- 用户提醒之前生成了两张参考试稿，均未用作 Lux3D 输入。文件保留于 `assets/lux3d/round-01/raccoon-multiview/unused-reference-trials/`，完整 [提示词及未采用原因](unused-imagegen-prompts.json) 已归档。
- 实际新增积分消耗未核对账单，记为未知，不把历史单图价格当作本次实查结果。赛事工具路径确认与商业使用权分开记录。

原始 GLB：289504 三角面、19180376 字节（18.29 MiB）、单 mesh / material、两张 2048² PNG、零骨骼与动画。ZIP 17584143 字节，7 项。详见 [脱敏产物清单](manifest.json)。源文件没有减面或改材质。

## 真实模型检查

Blender 5.2.1 LTS / Cycles CPU / 24 samples / 900×900。六张全身视角、四张尾根近景、两张同机位灰模近景共 **12 张**，均从新 GLB 实际渲染。灰模仅覆盖材质以检查轮廓，原始网格不变。各目录 render.json 保存来源哈希、相机设置和版本。

| 证据 | 结果 |
| --- | --- |
| [旧浣熊侧面](../2026-10-22-round-01/raccoon/left.png) | 用户已因尾根连接问题否决，原稿及材质试稿保留作历史 |
| [新正面](../2026-10-22-round-01/raccoon-multiview/front.png)、[新侧面](../2026-10-22-round-01/raccoon-multiview/left.png)、[新背面](../2026-10-22-round-01/raccoon-multiview/back.png) | 绿色披肩、开叉下摆、棕裤靴及尾巴环纹均生成；与上一版是不同模型，不能把构图相近当作逐点几何对比 |
| [尾根背面近景](../2026-10-22-round-01/raccoon-multiview/tail-closeup/back.png)、[后侧近景](../2026-10-22-round-01/raccoon-multiview/tail-closeup/elevated.png) | 衣服开叉可辨，但边缘仍紧贴尾根，缺少清楚的分离间隙 |
| [灰模背面](../2026-10-22-round-01/raccoon-multiview/clay/tail-closeup/back.png)、[灰模后侧](../2026-10-22-round-01/raccoon-multiview/clay/tail-closeup/elevated.png) | 停用贴图后尾根与下摆仍呈贴连轮廓，不能宣称连接问题解决；是否共用顶点及内部连接需进一步网格检查 |

结论：现有多视图可以作为生成输入；这次新模型补充了侧背信息，但**仍未满足尾巴独立于衣服的验收要求**。尾巴毛面还存在碎片感，衣服和靴子高光偏强。仅记录可见问题，不将离线图片视为动画或运行时验收。后续宜局部修整尾根和下摆、整理网格及材质，再验证绑定摆动；不自动再花积分抽取模型，也不强制减面。

## 验证与复现

- `python scripts/aholo/audit_multiview.py`：4 张输入来源/副本/上传台账哈希、图像解码、2 个下载文件哈希、ZIP CRC、GLB 容器与贴图解码通过。
- `node scripts/aholo/check.mjs`：单次创建、未知状态阻断、多图顺序/数量/哈希恢复保护通过；JS / Python 语法检查通过。
- `pnpm lint`、`pnpm test`（3/3）、`pnpm build` 通过；既有主 JS 1145.60 kB 体积警告仍在。
- 本地复核页增加新候选独立选项，旧浣熊标记不采用，原四项同场测量仍只加载原四项。页面和资源 HTTP 检查见 [验证记录](validation.json)。
- CUA 再次返回 apps / browsers 空列表：**未实机视觉验收、无 FPS/显存结果**。未绑定、未集成、未推送/部署。

离线复现：`python scripts/aholo/render_review_batch.py --blender <Blender路径> --wmi-fallback --assets raccoon-multiview`；尾根加 `--tail-closeup --views side back left elevated`；灰模加 `--clay --tail-closeup --views back elevated`。WMI 回退只作用于子进程。文件校验结果见 [validation.json](validation.json)。
