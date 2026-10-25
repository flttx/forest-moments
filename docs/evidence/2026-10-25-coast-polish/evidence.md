# 崖壁与溪流收尾 · 2026-10-25

状态：实现并完成本机限定验证。报告 v0.49，第 5.45 节。用户“继续”后，根据上一轮全岛视角中的实际问题，细化崖壁与溪口。不是新建地图、侵蚀模拟或水流物理。

## 改动与证据

- 崖壁采用三维噪声的矿物色块、细裂纹和轻微凹凸；插值法线平滑岩草过渡。二维投影中间版仍有拉伸，已撤换。
- 溪面横截面求实际岸线，源头收圆，入海渐隐；消除与海平面共面的矩形尾片，改为顺流纹理。河床、桥面高度和导航碰撞保持原样。
- 沿岸小石改用扁平切面、潮线布置，部分留空，避开溪口和码头。这是原程序几何调整，无新增 GLB 或生成服务调用。
- before/day-seaCliff.png 与 final-v2/day-seaCliff.png：同白天、同机位崖壁对比。
- before/day-creekMouth.png 与 final-v2/day-creekMouth.png：同白天、同机位溪口对比。
- final-v2/day-stream.png：桥下衔接与收圆源头。
- panorama/sunrise-horizon.png：真实 F 休息并等待日出约 6.2 秒，展示另一方向的全岛画面；不是同机位材质对比。

未制作新概念图，以现有扩岛方向与本次实机问题为依据。没有 Lux3D/AHOLO/Blender 新产物，既有资源来源沿用扩岛证据。35 项现役资产共 98,749,789 B，与上一轮和 dist 哈希一致。没有付费、上传、推送或部署。

## 验证与边界

Windows Edge 156.0.4314.42，1440×900 / DPR 1。lint 无警告；20 文件 / 82 项单测通过；build 通过，保留大分块提示。JS 1336.85 kB / gzip 379.64 kB。新增几何测试覆盖岸线、水位/桥面、源头、共面尾片透明和非有限值；既有地形连通及玩法单测通过。

最终有效截图共 38 张：final-v2 的 11 张加 overview 重拍 1 张、regression-v2 的三时段七场景 21 张、panorama 日出 1 张、production 4 张。各脚本检查 PASS、错误 0；对关键桥/溪口/岩壁、日出及各类场景抽图人工复核。固定场景使用开发状态夹具；生产组只验证加载/键鼠/无开发遥测，不冒称重新玩完全部旧流程或完整跨岛路线。

中间批次全部保留本机：before 12 张；after 12 张仍有投影拉伸和源头硬截口；final 首张鸟瞰包含延迟的加载提示。改为连续 1.5 秒没有加载提示后才拍摄，final-v2 首张仍出现无头截图的侧栏拼块残影，单独重拍 overview 正常；原图不删除，不计入最终有效图。后续脚本先请求一次预捕获，再等待 250 ms 获取正式画面，缓解合成层捕获问题。没有据此将产品逻辑或 DOM 内容错误写成已修复。

每批 headless-validation.json、未引用截图和逐帧数据只保留本机，精简结果见 [validation.json](validation.json)。报告引用的 6 张图显式加入 Git 忽略例外。源码和构建哈希记录在汇总中；没有重新测量 GPU 耗时、跨设备或公网加载。

高地几何轮廓仍是原程序崖坡，未手工雕刻岩层；这轮完成材质、边界与潮线细化，不宣称所有最终美术完成。木工衣袖、养鱼经营继续待办；上下床动画已按用户取消。

## 复现

启动开发 5176 / 生产预览 5178。用 FOREST_QA_OUT 指定新的项目内目录后运行：

- node scripts/check_coast_polish.mjs：三时段鸟瞰/海崖/溪口/桥；可用 FOREST_QA_VIEWS 和 FOREST_QA_LIGHTS 逗号列表限定机位、时段。
- node scripts/check_sleep_lighting_views.mjs：三时段七场景。
- node scripts/check_sleep_horizon.mjs：实际进入休息并等待日出。
- node scripts/check_expansion_production.mjs：编译包键鼠冒烟。

统一使用 scripts/browser-session.mjs；独立配置及 TEMP/TMP 在项目 .tmp，最外层 finally 执行 cleanup。截图不使用系统临时目录，不覆盖旧批次。
