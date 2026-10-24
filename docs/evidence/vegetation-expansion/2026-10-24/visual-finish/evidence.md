# 视觉收尾 · 2026-10-24

状态：已实现，本机限定验证通过。设计依据、参考图、前后对比和失败修正已直接嵌入 [主报告 5.27](../../../../report/PROJECT_REPORT.md)。本次没有新建模或 AHOLO 调用；既有码头任务仍为 4321451。

## 实施

- 整株遮挡覆盖率切换约 0.18 秒，加入迟滞与肩宽余量；高/低 LOD 共用可见度，网格缓冲共享，碰撞/阴影保留。
- `pondShape.ts` 统一不规则岸线，西岸固定，水位 -0.08 m。`terrainGeometry.ts` 只加密池塘周围 30 cm→6 cm；实际 mesh 水线误差测试小于 5 mm。
- `audit_dock_supports.py` 通过 Blender 5.2.1 LTS 只读检查六桩，见 [审计](dock-support-audit.json)。运行时码头 Y 比例 1.06，甲板高度仍为 0.12 m；外端桩底原高于海床约 7.4 cm，现进入约 6.6–6.7 cm。

## 最终验证

| 目录（相对上级） | 内容 | 截图数 |
| --- | --- | --- |
| `visual-finish-final/` | 昼夕夜各 14 机位、1920×1080/390×844、30 秒固定池塘采样、减少动态效果 | 44 |
| `visual-finish-route-final/` | 实际键盘完整陆地环路与返回，灯源及整株遮挡遥测 | 6 |
| `regression-visual-finish-final-fishing/` | 取消/早提竿/错过咬钩/暂停/张力/钓获/过载/刷新鱼簿 | 13 |
| `regression-visual-finish-release-fishing_production/` | 生产包真实按键、DOM 张力表、可见渔获及持久化 | 6 |
| `visual-finish-production-final/` | 生产包加载、步行到码头、上船/划行/返回下船，九项模型/轨迹资源 | 3 |

五组共 72 张原始截图，0 控制台异常；联系表是原图拼接索引，不重复计数。已查看三时段全机位联系表、布局图、池塘近景、环路、钓鱼关键帧和下船画面。完整状态与文件哈希见 [validation.json](validation.json)，资源及运行源码哈希见 [resource-validation.json](resource-validation.json)。

静态：lint 无警告，26/26 测试（8 文件）、TypeScript/Vite build 和 diff 检查通过。主 JS 1268.44 kB / gzip 356.39 kB，保留 >500 kB 警告；模型/轨迹/植被 100326865 B，源植被、my-blog 已使用源代码及 public/dist 哈希一致。

环境：Windows，Edge 156.0.4314.42，ANGLE / NVIDIA RTX 5060 Ti，WebGL 2.0，默认 1440×900 / DPR 1。固定池塘 30 秒 uncapped RAF + gl.finish：平均 1.782 ms、P95 3.0 ms、最大 15.2 ms；157 calls、3032988 triangles。夜间环路 49.948 秒：平均 1.557 ms、P95 3.0 ms、最大 123.9 ms，包含截图等待与尖峰。两段性能采样独立运行；交互复测不用于性能比较。这不是显示器帧率或低配设备保证。

## 迭代与失败留档

1. `visual-finish-initial/`：不规则轮廓已生效，但 30 cm 网格造成明显水线锯齿，局部加密后复拍。
2. `visual-finish-route/`：整株隐去消除圆洞，但邻树仍遮住肩部；扩大余量后进入最终环路版本。
3. `visual-finish-production/`：固定时长行走停在码头中段，断言没有看到上船按钮而失败。最终脚本用真实方向键继续小步前进，直到可见按钮变化，不注入游戏位置。
4. `regression-visual-finish-fishing/`：高张力截图时仍按收线键，截图耗时导致过载，等待张力下降超时。最终开发/生产脚本均在截图前松键，保留原张力阈值和失败规则。
5. `regression-visual-finish-final-fishing_production/` 是首次生产钓鱼 PASS；之后为同样的截屏时序防护重跑，仅最新 `release` 目录计入最终五组。

## 对比和边界

- 池塘、码头：前版 `coastal-final/day-pond.png` / `day-dock.png` 对新版 `visual-finish-final/` 同名图；相同固定机位/光照/尺寸，水波和草风时刻不锁定。
- 遮挡：前版 `coastal-ground-route/loop-24.png` 对新版 `visual-finish-route-final/loop-24.png`；相同路点和跟随相机配置，位置允许 0.2 m 偏差，后者额外等待 350 ms；不是逐像素受控对比。
- 桩脚埋深在不透明海水下，截图不能直接证明；使用 Blender 最低点和地形高度数值交叉核对。
- 整株隐去仍保留树干碰撞和阴影，过渡可能短暂出现点状覆盖；未宣称所有视角遮挡最终完成。池岸没有芦苇/睡莲，牧场仍占位，树苗成长、登船过渡及浮力待实现。
- 上一阶段完整海上环岛及故障恢复没有在本轮重跑，旧证据保留。没有提交、推送、部署或 PDF 导出。
