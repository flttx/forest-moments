# 浣熊尾根局部修整

日期：2026-10-22。来源：Lux3D 四视图任务 4268120 的原始 GLB。此次只有本地 Blender 操作，**没有新增 API 任务或积分消耗**。原始文件保留，未使用减面。

## 当前成果与验收边界

当前可复核候选为 `assets/lux3d/round-01/raccoon-multiview/tail-repair-v5.glb`，对应工作文件 `tail-repair-v5.blend`。290520 三角面（原始 289504）、19294288 字节（18.40 MiB）、两张原有 2048² 贴图、两个材质，无骨骼和动画。新增面来自局部切缝及其内侧表面，不是减面结果。[模型清单](manifest.json)。

沿衣摆原来的 V 形开叉，局部切开尾根两侧的可见粘连，保留中央连接。**背面和灰模已能辨认两侧分离缝，局部静态改善已确认；不等于完整资产、解剖连接、可绑定拓扑或动画验收通过。** 切口内侧使用临时棕色材质，局部平面感/暗缝仍需细化。原有毛面碎片感、偏强高光、隐藏内层连接仍未全面处理，正式游戏仍是占位角色。

| 同机位证据 | 原始模型 | 修整候选 v5 |
| --- | --- | --- |
| 背面近景 | [原始](../2026-10-22-round-01/raccoon-multiview/tail-closeup/back.png) | [修整后](../2026-10-22-round-01/raccoon-multiview/tail-repair-v5/tail-closeup/back.png) |
| 后侧近景 | [原始](../2026-10-22-round-01/raccoon-multiview/tail-closeup/elevated.png) | [修整后](../2026-10-22-round-01/raccoon-multiview/tail-repair-v5/tail-closeup/elevated.png) |
| 无贴图灰模 | [原始](../2026-10-22-round-01/raccoon-multiview/clay/tail-closeup/back.png) | [修整后](../2026-10-22-round-01/raccoon-multiview/tail-repair-v5/clay/tail-closeup/back.png) |
| 全身背面 | [原始](../2026-10-22-round-01/raccoon-multiview/back.png) | [修整后](../2026-10-22-round-01/raccoon-multiview/tail-repair-v5/back.png) |

v5 共 12 张实际 Blender 渲染：6 张全身、4 张尾根、2 张灰模；900×900、Cycles CPU 24 samples，沿用原稿 bounds / 归一化比例 / 相机 / 灯光。它们是模型离线渲染，不是浏览器截图。

## 修整方法与失败留档

- v1 / v2：环形切割产生不自然的圆洞/环形边，拒绝。
- v3：改为 V 形窄缝，位置偏离原接缝，黑边较宽；区域外几何保留检查也失败，拒绝。
- v4：从已保存的原始正交背面近景选取两侧接缝像素，射线定位到真实模型坐标，见 [测得的接缝点](source-seam-points.json)。切缝位置改善，但布尔运算仍丢弃了区域外 307 个量化位置，不能作为“只改尾根”的成果。
- v5：只采用布尔结果在局部范围内的面，区域外逐面回填原始网格、UV 和法线。保留失败试稿及其检查记录，不覆盖原始 GLB。未进行全身重拓扑或全局焊接。

布尔候选网格经过 Blender 数据校验；这不证明模型是流形、可绑定或没有隐藏连接。v1 导出曾提示无效网格，v2 起在候选上执行数据校验；v5 只拼接局部修整片，区域外原始细碎几何没有因此被清理。导出仍有采样器节点选择警告，原贴图字节一致与离线渲染已检查，浏览器行为仍待验证。

## 文件与范围验证

`python scripts/aholo/audit_tail_repair.py` 通过：

- 原始 GLB SHA-256 不变；两张内嵌纹理逐字节相同。
- 修整区域之外 **270178 个三角面**按几何坐标多重集合核对，缺失 0、新增 0（坐标精度 1e-7 原始单位）。
- 顶点位置检查显示 1 个位于边界外的原位置消失；该点属于接触修整盒的三角面，而非保留区的面。检查以完整三角面为边界，未放宽通过阈值来忽略远处变化。
- GLB 容器、面数、内嵌贴图解码通过。细节见 [结构检查](../2026-10-22-round-01/raccoon-multiview/tail-repair-v5/file-validation.json) 与 [修整参数](../2026-10-22-round-01/raccoon-multiview/tail-repair-v5/repair.json)。

本轮 lint、test（3/3）、build、JS / Python 语法检查通过；既有主 JS 1145.60 kB 包体积警告仍在。26 张本轮图片（含 14 张失败/过渡版、12 张 v5）的解码、尺寸及来源哈希核对见 [验证记录](validation.json)。

本地复核页默认展示尾根修整候选，可切回两版原稿比较，四项同场仍是历史四项原稿。入口：http://127.0.0.1:5176/scripts/aholo/review.html 。HTTP 可访问只证明资源服务正常。CUA 返回 apps / browsers 空列表，**未实机视觉或性能验收**。下一步细化切口内侧、检查尾根内部拓扑与骨骼权重，再做连续摆尾/走跑检查；不能把当前静态间隙当作自然摆尾已实现。

复现：`python scripts/aholo/blender_run.py scripts/aholo/repair_tail.py --blender <Blender路径> --variant tail-repair-v5`。渲染沿用 `render_review_batch.py --assets raccoon-multiview --variant tail-repair-v5`，近景加 `--tail-closeup`，灰模再加 `--clay`。每个输出目录的 render.json 记录来源哈希。
