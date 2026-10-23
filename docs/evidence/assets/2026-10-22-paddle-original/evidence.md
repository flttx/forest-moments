# 弃用 IK，恢复原始划桨动作 · 2026-10-22

用户反馈并提供两张图：适配版从起始姿势就出现抱臂/拧肩，左右换手时手臂破面。上一轮数值检查未覆盖这种整体姿态与表面质量问题，不能作为动作可用证明；撤回“下一项直接接入该派生动作”的结论，也不再把可见破面简单归因为原蒙皮。

已执行：

- 整份手臂 IK 试稿弃用，保留失败文件与证据；`adapt_paddle.py` 和 `audit_paddle_candidate.py` 的生成/导出入口明确阻止执行。
- 复核页直接加载 `public/assets/models/raccoon.glb`，只播放已有 `paddle`，不修改动画轨道、不应用 IK 或手臂覆盖。原始来源为 my-blog 的 `public/assets/world/player/raccoon-mixamo.meshopt.glb`，已在既有 `reuse_native_mixamo_rig.py` 中记录复用过程。
- 保持船、角色的原组合实例位置；暂时隐藏未重新匹配的船桨，明确界面只是原动作姿态复核，不能将隐藏道具当成穿舷修复。
- 模型、衣摆、尾巴、权重和原始 19 动作文件未改。当前角色 SHA-256 仍为 `f35123a06d790a6802d20f278c4d2c23997ccf16c49dfd56923e6d8acf8a2a41`。

## 当前证据

`audit_original_paddle.py` 从原组合中读取无约束的原动作 217 帧作为对照，输出 `original-poses.json`。独立无头 Edge 155、1440×900 直接播放原 GLB，对照手位最大误差约 0.0044 mm；15 秒跨越两个循环，0 控制台异常。保存 18 张原动作截图，`headless-validation.json` 记录实际结果。

- [起始姿势](headless-right-000.png)
- [换边阶段](headless-right-027.png)
- [原动作近景](headless-grip-close.png)
- [已弃用适配版同机位近景](../2026-10-22-paddle-fit/headless-grip-close.png)

已查看原动作起始和近景，对比确认不再使用那份改写后的手臂姿势。此处验证的是**原动作恢复和播放一致性**，不是新船与桨配合完成，也不宣称原绑定的所有帧都无表面缺陷。下一步先以原动作作为不可改写的基线，调整道具握点、尺寸和随动；不再通过改变手臂姿势迁就船桨。

静态验证和文件哈希结果见 `validation.json`。没有付费调用、提交、推送或部署；正式游戏此前未采用 IK 试稿，因此无须替换游戏资产。
