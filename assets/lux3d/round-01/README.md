# Lux3D 第一轮原始候选

最新修整（同日再后续）：`raccoon-multiview/tail-repair-v5.glb` 是本地 Blender 尾根切缝候选；原始 GLB 与贴图保留，修整区域外 270178 三角面核对一致。背面/灰模两侧间隙可辨，切面细化、内部拓扑、绑定和实机仍待验证。v1–v4 仅为失败/过渡留档，未采用；见 [局部修整证据](../../../docs/evidence/assets/2026-10-22-raccoon-tail-repair/evidence.md)。没有新增生成费用或减面。

最新状态（同日后续）：旧浣熊被用户因尾根与衣服连接问题否决。按用户指定的现有四视图生成新任务 4268120，原始结果保存在 `raccoon-multiview/`；新模型已下载但尾根近景/灰模仍显示贴连，未通过视觉复核。见 [四视图重生成证据](../../../docs/evidence/assets/2026-10-22-raccoon-multiview/evidence.md)。此候选未替换游戏角色。

日期：2026-10-22。用户授权开始第一轮 Aholo API 模型生成，沿用本机已验证的中国区路由 `https://api.aholo3d.cn`；与未来 ModelScope 国际站部署无关。

范围：浣熊、工坊、开放木塔、独木舟各一个候选。模型版本 G1，目标面数 300000，输出 ZIP + GLB；属于保留细节的原始高模，不是浏览器交付面数预算。正式场景仍须遵守 `docs/ASSET_PIPELINE.md` 的下载预算。

- `inputs/`：实际上传的单资产 PNG。浣熊从新版造型板整理为单角色，工坊与木塔移除版头文字；独木舟逐字节复制现有单体图。
- `<asset>/output-0.zip`、`output-1.glb`：平台原始返回文件，保留 SHA-256。
- `<asset>/ledger.json`、`result.json`：仅本地保存的恢复台账和平台响应，可能含临时资源 URL，已加入 Git 忽略。不可删除后重建任务。
- `<asset>/review.blend`：已由复核脚本生成的独立 Blender 场景；进程级 WMI 回退已恢复离线渲染。预览脚本只添加归一化父级与摄影棚灯光，不做减面、重拓扑或绑定。
- 脱敏清单与离线渲染：`docs/evidence/assets/2026-10-22-round-01/`。

## 操作

在仓库根目录运行 `./scripts/aholo/round-01.ps1`。它按固定四项清单串行处理；已存在且成功下载的任务先核验哈希，其他已确认任务继续查询。已有台账却没有任务 ID 时停止，必须核对平台历史，不自动重提。创建接口只有一次尝试。

若已确认台账停在 `reserved` / `uploaded`、尚未进入创建接口，可显式执行 `./scripts/aholo/run.ps1 resume-upload assets/lux3d/round-01/<asset>` 恢复上传。此命令核验输入哈希、路由与参数，拒绝已有任务 ID 或处于 `submitting` / `submission_unconfirmed` 的台账；不会删除原台账。不要同时运行多个提交或恢复进程。

密钥由 `scripts/aholo/run.ps1` 从进程或 Windows 用户/系统环境变量读取，值不写文件、不输出日志。脚本迁自本机已跑通的 `D:/codex/2026-10-21/https-labs-aholo-ai-api-docs/outputs/aholo-dev/`；原目录保留。

全部下载后运行 `python scripts/aholo/audit.py`，检查 SHA-256、ZIP CRC、GLB 容器、面数、贴图解码、骨骼和动画数量。离线渲染使用 `python scripts/aholo/render_review_batch.py --blender <blender.exe路径> --wmi-fallback`，原始 GLB 不变。WMI 回退仅作用于渲染子进程，不修改系统。

开发预览入口：运行 `pnpm dev --host 127.0.0.1` 后打开 `/scripts/aholo/review.html`。此页面不进入生产入口，也不自动将原始模型打入游戏。

## 授权与证据边界

本轮仅生成本地项目候选；商业使用权、公开分发与赛事素材授权尚未逐件核实。用户提供的主办方文字回复仅支持官方 Lux3D API 工具路径符合参赛要求，详见赛事规则记录。

生成响应未提供积分消耗字段。用户在本轮提供账单截图：2026-10-22 09:59 和 10:04 两笔 Lux3D 生成 - API 各扣 20 积分，截图时余额 3540，并确认继续。中国区余额查询接口两次返回 HTTP 500，不能解读为余额为零。后续两次按相同 G1 参数预计各 20 积分，实际扣费及最终余额仍以账单为准。没有执行自动重生、绑定、重拓扑或其他付费后处理。实际成功、失败和文件数据以脱敏清单为准。

## 2026-10-22 离线复核

已完成原稿 25 张、试稿 19 张真实 Blender 渲染。工坊与船的 `optimized-v1` / `optimized-v2` GLB 和 blend 仅为失败试验留档，两版均出现明显外观失真，禁止作为正式资产。详见 [视觉筛选与失败对比](../../../docs/evidence/assets/2026-10-22-round-01/visual-review.md)。

减面不是必须工序。优先保留原稿、修复结构和材质，获得实机性能证据后再决定贴图/文件压缩、按需加载、局部减面或 LOD；目前没有实机性能数据，不强制制作低模。

## 原面数材质与诊断

浣熊 `material-v1.glb` 仅改 PBR JSON，二进制块与原稿相同；属于哑光对比候选，未定为最终材质。`review-clay.blend` 是工坊/船的无贴图诊断场景，不是修复产物。查看 [本轮证据](../../../docs/evidence/assets/2026-10-22-round-01/material-diagnostics.md)。复核页可切换原稿/浣熊候选或同时加载四项原稿，并在前台测量 30 秒；没有预填性能结果。
