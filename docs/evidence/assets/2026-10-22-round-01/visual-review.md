# 首轮模型离线视觉筛选与减面试验

2026-10-22。**完成 Blender 离线筛选；四项均保留原稿继续修整，尚无可发布模型。工坊与船的两版直接减面试稿均不采用。**

## 渲染证据

实际使用 Blender 5.2.1 LTS / Cycles CPU、24 samples、900×900、AgX、相同摄影棚灯光。从原始 GLB 导入，只有预览归一化父级，没有改写原文件。四项原稿共 25 张：每项正面、斜侧、右侧、背面、左侧、高视角；船另有底部。试稿另有 19 张，共 44 张实际渲染 PNG。视角名称按源模型坐标定义，船长轴与建筑朝向不相同。

原稿与 v2 使用原稿边界确定缩放、机位和构图；v1 按各自边界归一化，存在轻微构图差异，不作逐像素误差比较。船的相机范围扩大到 4.8，避免长船斜视裁切；当前七张船原稿均已重渲染。

| 资产 | 实际查看结果 | 下一道工序 | 关键原稿图片 |
| --- | --- | --- | --- |
| 浣熊 | 面罩、披肩、下垂环纹尾巴成立；正面手臂与躯干、双腿之间有空隙，侧面尾巴与腿有距离。头后和尾巴碎毛过密；衣服、手和鞋高光偏强。静态空隙不证明蒙皮后不穿模 | 保留造型；整理毛块、关节拓扑与材质，再绑定及检查尾巴动态 | [正面](raccoon/front.png)、[侧面](raccoon/side.png)、[背面](raccoon/back.png) |
| 工坊 | 左附棚、低石基、无烟囱和工作台符合方向。背墙屋脊下与附棚檐口可见黑色孔隙/暗缝；门、工作台等仍是单网格的一部分 | 保留轮廓；检查背面孔隙、拆门与交互件，先修结构；是否制作低模/烘焙由实机性能决定 | [斜侧](workshop/three-quarter.png)、[附棚](workshop/left.png)、[背面](workshop/back.png) |
| 木塔 | 底层开放、四主柱、分离石脚、折返梯形态可见。顶部楼梯口有横向木构件，踏步与转折平台局部不规则；不能认定可通行 | 先修楼梯、顶部开口与连续扶手；按角色尺寸验证通路，再优化 | [斜侧](lookout/three-quarter.png)、[楼梯背面](lookout/back.png)、[高视角](lookout/elevated.png) |
| 独木舟 | 青绿船壳、浅舷边、木内舱及座位成立。内舱与底部可见黑斑/凹坑，部分可能涉及几何或材质问题，截图不足以区分；没有独立船桨 | 保留轮廓；核查船底、整理舱内和座位，检验角色及尾巴容纳空间；是否重做低模由实机性能决定 | [斜侧](canoe/side.png)、[舱内](canoe/elevated.png)、[船底](canoe/bottom.png) |

## 两版试验均未通过

两版均保存独立 GLB、Blender 工作文件、渲染场景与 `optimization.json`。这些文件名中的 `optimized` 表示试验分支，**不表示优化验收通过，禁止接入正式场景**。

| 资产 / 版本 | 三角面 | GLB 字节 | 实际结果 |
| --- | ---: | ---: | --- |
| 工坊原稿 | 283475 | 18645196 | 保留 |
| 工坊 v1 | 30000 | 4015796 | 屋顶、边角出现裂片及三角痕迹，不采用 |
| 工坊 v2 | 54604 | 5871304 | 合并位置重复顶点后，表面/纹理严重失真，不采用 |
| 船原稿 | 287052 | 17276320 | 保留 |
| 船 v1 | 12000 | 2950080 | 船壳、船舷出现显著三角色块，不采用 |
| 船 v2 | 34610 | 4240240 | 船壳与内舱出现大面积失真，不采用 |

对比：[工坊原稿](workshop/three-quarter.png) / [v1](workshop/optimized-v1/three-quarter.png) / [v2](workshop/optimized-v2/three-quarter.png)；[船原稿](canoe/three-quarter.png) / [v1](canoe/optimized-v1/three-quarter.png) / [v2](canoe/optimized-v2/three-quarter.png)。

v1 使用 collapse decimation 并把贴图缩到 1024²；v2 先合并相同位置顶点，保留角点 UV，再做同类减面。v2 受网格结构影响没有达到请求面数，以导出 GLB 实测为准。没有烘焙新的贴图或法线；不能把直接沿用原贴图的减面流程当作最终方案。用户随后指出减面并非必需，调整为：先检查拓扑、修复原模型结构与材质，接入受控实机场景测量帧率、加载和内存。只有几何确为瓶颈时才制作低模/LOD；届时重新展开 UV、烘焙只是候选方案，不预先强制执行。浣熊和木塔没有进行这些减面试验。

Blender 导入工坊后计数与原 GLB 索引计数有少量差别（v1 导入 283470，合并导入 283462）；原稿的 283475 仍以文件索引为准。不可把导入处理后的计数回写为平台原始数据。

## 启动阻塞与复现

关闭音频、限制线程、强制 OpenGL、隔离用户配置均未解决。随后在 Blender 自带 Python 中独立复现：`platform.system()` 8 秒超时；只在该子进程设 `platform._wmi=None` 后立即返回真实的 `Windows AMD64`。Blender 使用同一进程级处理后正常执行并退出，实际完成全部渲染。WMI 服务本身的根因未调查，不代表系统已修复。

`scripts/aholo/blender_bootstrap/sitecustomize.py` 仅在显式环境开关启用时让 Python 使用其既有 Win32/注册表回退。未修改系统服务、用户配置或 Blender 安装。`render_review_batch.py` 设每项 600 秒超时与脚本失败退出码，日志仅本地保存。诊断曾参考 [Blender 官方启动排障说明](https://docs.blender.org/manual/en/latest/troubleshooting/startup.html)，WMI 定位来自本机对照实验。

```powershell
python scripts/aholo/render_review_batch.py --blender 'D:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --wmi-fallback
# 船底补充视角
python scripts/aholo/render_review_batch.py --blender 'D:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --wmi-fallback --assets canoe --views bottom
```

## 性能决策修正

原稿合计约 115.10 万三角面、69.00 MiB，这些数字提示需要测量，不等于不能运行。没有实机场景数据，不能判定必须减面。本次直接减面属于提前开展的探索，视觉失败已否决。优先保留原稿外观；下载瓶颈先检查贴图/文件压缩与按需加载，只有确认几何渲染压力时再按重要性做局部减面或 LOD。项目下载预算是目标，不应以损伤画质强行满足。

## 验证边界

- 44 张图可解码且均为 900×900，GLB 来源与渲染记录哈希匹配；原始四项 GLB / ZIP 哈希与 CRC 再次通过。见 [检查清单](review-validation.json)。
- 四个试稿 GLB 容器与纹理解码通过、无新增 required extensions，均无骨骼/动画。这不改变它们视觉不合格的判定。
- pnpm lint、pnpm test（3/3）、pnpm build、生成脚本离线保护检查与 Python 语法检查通过。既有主 JS 1,145.60 kB 警告仍在。
- 浏览器工具没有可用实例，**未实机视觉验收**；没有 FPS、碰撞、可行走楼梯或动画通过证据。正式游戏仍使用原来的几何占位。
- 本次仅本地 Blender 操作，没有新 API 生成、没有新增积分消耗，也未推送或部署。
