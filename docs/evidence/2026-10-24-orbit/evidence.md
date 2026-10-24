# my-blog 控制与自由镜头 · 2026-10-24

状态：本机限定验证通过。浏览器：隔离 headless Edge 156.0.4314.42，1440×900；开发 5176，生产静态预览 5178。报告第 5.40 节包含问题、方案和图片。

## 参考实现

实际读取本机 `F:/Projects/my-blog/src/world` 下的 PlayerController.ts、Player.tsx、CameraHeading.ts、FollowCamera.tsx 和 WorldCanvas.tsx，文件路径和读取版本 SHA-256 见 reference-sources.json。参考点：每帧相对独立相机水平基向量移动；行走不自动转镜；右键 CSS 坐标差、Q/E、俯仰限制、指数阻尼/缩放；只有船上延迟回正。未修改 my-blog，也未声称本轮启动并重新验收了它。

本项目采用相同输入关系和灵敏度，保留现有角色动画、走跑速度、碰撞、室内外取景距离。相机方位正负和船体前向轴做本项目适配。鼠标不改变角色位置，按住 W 拖动才连续改变行进路线；A/D→W 的语义现在是视角侧向→视角前方，替代 v0.43 的角色最新朝向规则。

## 检查记录

| 目录 | 检查范围 | 截图 | 状态 |
| --- | --- | ---: | --- |
| before | 修改前相同右键拖动，旧镜头无响应 | 2 | 采集成功，不是新功能通过 |
| controls | 昼/夕/夜 × 室内外，24 方向位移断言；右键/按住 W 转镜/QE/俯仰/滚轮/失焦/专用交互/船/塔 | 26 | PASS |
| edges-verified | 门边与两侧墙边高低俯仰/远近极限，鼠标移出窗口释放、独立 pointercancel | 7 | PASS |
| navigation | 长按直线、W 镜头方向、失焦、真实键盘进入工坊/走到工位/开始并取消制作/出门 | 6 | PASS |
| production | 无开发遥测的页面加载、W、右键拖动中按 W、滚轮、HUD | 4 | PASS |

最终四组 43 张、控制台异常为零。before 和初次 edges 不计入最终数量。初次 edges 数值检查通过，但 wall-0-low.png 出现重复拼块且缺失 HUD，图片保留；同场景在新隔离浏览器中重新采集正常，原因没有进一步归因。edges-verified 还加强了 pointercancel 断言，确保在物理抬键之前已经结束拖动。

实际查看了同输入前后、昼/夜室内外环绕、高低俯仰、生产版拖动/缩放、工位、墙边、船上和塔上图。墙边高俯仰会呈现明显俯视，低俯仰近距离角色占画面较多；所查墙体约束通过，仍保留用户选择的镜头方向。塔上某些朝向有木柱横梁遮挡，室内墙脚亮缝仍在，不宣称所有观景角度美术验收完成。

开发脚本通过 QA 设置测试起点和交互阶段，实际操作使用 CDP 键盘/鼠标事件；生产组不注入状态，数值断言来自开发组。没有重跑全部旧世界轴/角色朝向的玩法宏，旧脚本保留为历史。新增鼠标控制在钓鱼、制作、喂食、种植/观察、过场时禁用，返回漫游恢复。

## 验证与复现

pnpm lint 无警告；pnpm test 17 文件 70/70；pnpm build 通过，主 JS 1308.37 kB / gzip 369.89 kB，保留既有分块警告。初次浮点严格相等断言和 React ref/DOM 赋值警告已修正，细节记录于报告。没有新模型、生成参考图、Lux3D/Blender 产物或付费调用。

串行运行 scripts/check_orbit_controls.mjs、check_orbit_edges.mjs、check_orbit_navigation.mjs、check_orbit_production.mjs。前两者可用 FOREST_ORBIT_STAGE 指定新目录以避免覆盖证据。python scripts/audit_orbit.py 核对报告链接、PNG 尺寸、最终分组 PASS、方向对齐与 26 项资源哈希/public-dist 一致性。所有浏览器均在最外层 finally 清理自身 .tmp 配置和缓存；未发布或部署。
